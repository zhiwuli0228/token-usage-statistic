/**
 * Host half of the token-usage-statistic bundle.
 *
 * Responsibilities:
 *  1. Observe usage samples from committed session events and append them to a
 *     private JSONL ledger.
 *  2. Rebuild the in-memory fold from that ledger at activation, so statistics
 *     survive restarts and HMR reloads.
 *  3. Backfill history from Session persistence, incrementally, in the
 *     background.
 *  4. Serve the panel's read model on one exact HTTP route.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { IDLE_BACKFILL, ROUTES, createHttpHandler } from './api.js'
import { AccountRegistry, emptyAccountsPayload } from './accounts/registry.js'
import { budgetState } from './budgets.js'
import { Backfill, type Persistence } from './backfill.js'
import { Collector } from './collector.js'
import { defaultDataFile, resolveConfig } from './config.js'
import { LedgerWriter, loadLedger } from './ledger.js'
import { createPricer } from './pricing.js'
import { SessionNameService, type SessionQueryLike, type WorkspaceLike } from './sessionNames.js'
import { UsageStore } from './store.js'
import type { BackfillStatus } from './types.js'
import type { EventLike } from './usage.js'

/** This bundle's package name, also the patch row id. */
export const PACKAGE = 'token-usage-statistic'

/** The minimal Host context this plugin uses. */
interface HostContext {
  effect(callback: () => (() => void) | void): unknown
  on(name: string, listener: (...args: any[]) => void): () => void
  inject(deps: readonly string[], callback: (scope: HostContext) => void): unknown
  get(name: string): unknown
}

/** The Web carrier subset used here. */
interface WebServerLike {
  register(route: { kind: 'exact'; path: string; handler: (request: any, response: any) => void }): () => void
  getOrigin?(): string
}

function warn(...values: unknown[]): void {
  try {
    console.warn(`[${PACKAGE}]`, ...values)
  } catch {
    /* logging must never break a model call */
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Write a small activation receipt beside the ledger. */
function createActivationRecorder(dataFile: string): (patch: Record<string, unknown>) => Promise<void> {
  const file = path.join(path.dirname(dataFile), 'activation.json')
  return async (patch) => {
    try {
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(file, `${JSON.stringify({ at: Date.now(), dataFile, ...patch }, null, 2)}\n`, 'utf8')
    } catch (error) {
      warn('activation receipt could not be written:', describeError(error))
    }
  }
}

/** Activate the plugin. */
export async function apply(ctx: HostContext, config?: unknown): Promise<void> {
  const settings = resolveConfig(config)
  const dataFile = settings.dataFile || defaultDataFile()
  const recordActivation = createActivationRecorder(dataFile)

  const pricer = createPricer(
    {
      rules: settings.pricingRules,
      aliases: settings.modelAliases,
      providers: settings.pricedProviders,
    },
    (message) => warn(message),
  )
  const store = new UsageStore({ pricer, recentLimit: settings.recentLimit })
  const ledger = new LedgerWriter(dataFile, { onError: (error) => warn('ledger append failed:', describeError(error)) })
  const collector = new Collector()
  const sessionNames = new SessionNameService({ log: (message) => warn(message) })
  let backfill: Backfill | undefined
  let registry: AccountRegistry | undefined

  try {
    const loaded = await loadLedger(dataFile)
    store.applyAll(loaded.records)
    const diagnostics = store.diagnostics()
    if (loaded.skipped > 0) warn(`ignored ${loaded.skipped} unreadable ledger line(s) in ${dataFile}`)
    if (diagnostics.skipped > 0) warn(`ignored ${diagnostics.skipped} invalid ledger record(s)`)
  } catch (error) {
    warn('ledger could not be read, starting from an empty fold:', describeError(error))
  }

  /** Ingest one event from either the live feed or the historical scan. */
  const ingest = (session: { id?: string } | undefined, event: EventLike | undefined): void => {
    const collected = collector.observe(session, event)
    if (collected === null) return
    if (!store.apply(collected.sample)) return
    void ledger.append(collected.sample)
  }

  ctx.effect(() => ctx.on('session/event', (session: { id?: string }, event: EventLike) => ingest(session, event)))
  ctx.effect(() => ctx.on('session/disposed', (session: { id?: string }) => collector.forget(session?.id)))
  ctx.effect(() => () => {
    void ledger.flush()
  })

  ctx.inject(['webServer'], (scope) => {
    const server = scope.get('webServer') as WebServerLike | undefined
    if (server === undefined || typeof server.register !== 'function') {
      warn('webServer is unavailable; the panel will report HTTP 404')
      return
    }
    const handler = createHttpHandler({
      store,
      backfill: (): BackfillStatus => backfill?.getStatus() ?? IDLE_BACKFILL,
      accounts: () => registry?.snapshot() ?? emptyAccountsPayload(settings.accounts.refreshMs),
      budgets: (now: number) => budgetState(store, settings.budgets, now),
      refreshAccounts: () => {
        void registry?.refresh()
      },
      refreshMs: settings.refreshMs,
      sessionNames,
    })
    try {
      for (const route of Object.values(ROUTES)) {
        scope.effect(() => server.register({ kind: 'exact', path: route, handler }))
      }
      let origin: string | undefined
      try {
        origin = server.getOrigin?.()
      } catch {
        origin = undefined
      }
      void recordActivation({ route: 'registered', origin, paths: Object.values(ROUTES) })
    } catch (error) {
      warn('web route registration failed:', describeError(error))
      void recordActivation({ route: 'failed', error: describeError(error) })
    }
  })

  ctx.inject(['workspaceRegistry', 'sessionQuery'], (scope) => {
    try {
      sessionNames.setSources({
        workspaceRegistry: scope.get('workspaceRegistry') as { list(): WorkspaceLike[] } | undefined,
        sessionQuery: scope.get('sessionQuery') as SessionQueryLike | undefined,
      })
      void sessionNames.refresh(store.sessionIds())
    } catch (error) {
      warn('workspace/session-name services unavailable:', describeError(error))
    }
  })

  ctx.inject(['settings', 'credentials'], (scope) => {
    registry = new AccountRegistry({
      services: scope,
      dataDir: path.dirname(dataFile),
      config: settings.accounts,
      version: '0.3.0',
      log: (message) => warn(message),
    })
    if (typeof (registry as AccountRegistry & { loadCache?: () => Promise<void> }).loadCache === 'function') {
      void registry.loadCache()
    }
    scope.effect(() => registry?.start() ?? (() => {}))
  })

  if (settings.backfill) {
    ctx.inject(['sessionPersistence'], (scope) => {
      const persistence = scope.get('sessionPersistence') as Persistence | undefined
      if (persistence === undefined) {
        warn('sessionPersistence is unavailable; only live usage will be recorded')
        return
      }
      backfill = new Backfill({
        persistence,
        lastSeqOf: (sessionId) => store.lastSeq(sessionId),
        onEvent: (sessionId, event) => ingest({ id: sessionId }, event),
        log: warn,
      })
      scope.effect(() => {
        const timer = setTimeout(() => {
          void backfill?.run()
        }, 1500)
        return () => clearTimeout(timer)
      })
    })
  }
}
