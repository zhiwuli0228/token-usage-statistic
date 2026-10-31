/**
 * Host half of the token-usage-statistic bundle.
 *
 * Responsibilities, in order of importance:
 *
 *  1. Observe committed `assistant/message` events and append one ledger line
 *     per call that reported usage.
 *  2. Rebuild the in-memory folds from that ledger when the plugin activates,
 *     so statistics survive restarts and HMR reloads.
 *  3. Serve the panel's read model on a small HTTP route under
 *     `/token-usage-statistic/`.
 *
 * The plugin deliberately owns only derived state: the durable Session log
 * remains the source of truth for what the model saw, and this ledger is a
 * private, rebuildable cache of the usage reported for it.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { Collector } from './src/host/collector.js'
import { API_PREFIX, createHttpHandler } from './src/host/http.js'
import { LedgerWriter, loadLedger } from './src/host/ledger.js'
import { UsageStore } from './src/host/store.js'

/** This bundle's package name, also the patch row id. */
export const PACKAGE = 'token-usage-statistic'

const DEFAULT_REFRESH_MS = 15000
const DEFAULT_SESSION_LIMIT = 12
const DEFAULT_RECENT_LIMIT = 200

/**
 * Report a non-fatal problem without depending on a logger service.
 *
 * @param {...unknown} values - message parts.
 * @returns {void}
 */
function warn(...values) {
  try {
    console.warn(`[${PACKAGE}]`, ...values)
  } catch {
    /* logging must never break a model call */
  }
}

/**
 * Turn anything thrown into a readable line.
 *
 * @param {unknown} error - thrown value.
 * @returns {string} message text.
 */
function describeError(error) {
  if (error instanceof Error) return error.message
  return String(error)
}

/**
 * Write a tiny activation receipt beside the ledger.
 *
 * The HTTP surface is the one part of activation whose failure is silent in a
 * GUI-only deployment: a route that never registered looks exactly like a route
 * that answered 404. This file records which branch ran, so a support question
 * ("the panel says HTTP 404") can be answered from disk.
 *
 * @param {string} dataFile - ledger path, whose directory hosts the receipt.
 * @returns {(patch: Record<string, unknown>) => Promise<void>} recorder.
 */
function createActivationRecorder(dataFile) {
  const file = path.join(path.dirname(dataFile), 'activation.json')
  return async function record(patch) {
    try {
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(file, `${JSON.stringify({ at: Date.now(), dataFile, ...patch }, null, 2)}\n`, 'utf8')
    } catch (error) {
      warn('activation receipt could not be written:', describeError(error))
    }
  }
}

/**
 * The default ledger location.
 *
 * It sits beside the profile's own data under `$DSH_HOME`, not inside this
 * workspace: the statistics describe the whole machine's Harness usage, so they
 * must outlive any one checkout.
 *
 * @param {Record<string, string | undefined>} [env] - environment to read.
 * @param {string} [home] - home directory fallback.
 * @returns {string} absolute ledger path.
 */
export function defaultDataFile(env = process.env, home = os.homedir()) {
  const configured = typeof env?.DSH_HOME === 'string' ? env.DSH_HOME.trim() : ''
  const root = configured.length > 0 ? configured : path.join(home, '.dsh')
  return path.join(root, PACKAGE, 'usage.jsonl')
}

/**
 * Normalize the row's `config` into the values this plugin actually uses.
 *
 * No schema is declared because this package is plain JavaScript without a
 * schemastery dependency; unknown keys are ignored and malformed values fall
 * back instead of failing activation.
 *
 * @param {unknown} input - patch row config.
 * @returns {{ dataFile: string, refreshMs: number, sessionLimit: number, recentLimit: number }} resolved settings.
 */
export function resolveConfig(input) {
  const config = input !== null && typeof input === 'object' ? input : {}
  const dataFile = typeof config.dataFile === 'string' && config.dataFile.trim().length > 0 ? config.dataFile.trim() : ''
  const refreshMs = Number(config.refreshMs)
  const sessionLimit = Number(config.sessionLimit)
  const recentLimit = Number(config.recentLimit)
  return {
    dataFile,
    refreshMs: Number.isFinite(refreshMs) && refreshMs >= 3000 ? Math.floor(refreshMs) : DEFAULT_REFRESH_MS,
    sessionLimit: Number.isFinite(sessionLimit) && sessionLimit > 0 ? Math.min(Math.floor(sessionLimit), 100) : DEFAULT_SESSION_LIMIT,
    recentLimit: Number.isFinite(recentLimit) && recentLimit >= 0 ? Math.min(Math.floor(recentLimit), 5000) : DEFAULT_RECENT_LIMIT,
  }
}

/**
 * Activate the plugin.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - owning plugin context.
 * @param {Record<string, unknown>} [config] - the row's config.
 * @returns {Promise<void>} resolves once the ledger has been replayed.
 */
export async function apply(ctx, config) {
  const settings = resolveConfig(config)
  const dataFile = settings.dataFile || defaultDataFile()
  const store = new UsageStore({ recentLimit: settings.recentLimit })
  const ledger = new LedgerWriter(dataFile, { onError: (error) => warn('ledger append failed:', describeError(error)) })
  const recordActivation = createActivationRecorder(dataFile)

  try {
    const loaded = await loadLedger(dataFile)
    for (const record of loaded.records) store.apply(record)
    if (loaded.skipped > 0) warn(`ignored ${loaded.skipped} unreadable ledger line(s) in ${dataFile}`)
    store.ledgerBytes = loaded.bytes
  } catch (error) {
    warn('ledger could not be read, starting from an empty fold:', describeError(error))
  }

  const collector = new Collector()

  ctx.effect(() =>
    ctx.on('session/event', (session, event) => {
      const record = collector.observe(session, event)
      if (record === null) return
      if (!store.apply(record)) return
      void ledger.append(record)
    }),
  )

  ctx.effect(() => ctx.on('session/disposed', (session) => collector.forget(session?.id)))

  ctx.effect(() => () => {
    void ledger.flush()
  })

  ctx.inject(['webServer'], (scope) => {
    const handler = createHttpHandler({ store, config: settings })
    try {
      const server = scope.webServer
      const origin = typeof server.getOrigin === 'function' ? server.getOrigin() : undefined
      // Exact paths only: this deployment accepts a `prefix` registration but
      // never dispatches it (verified against the running Web carrier), and the
      // panel needs exactly one endpoint anyway.
      scope.effect(() => server.register({ kind: 'exact', path: `${API_PREFIX}api/summary`, handler }))
      void recordActivation({ route: 'registered', origin, paths: [`${API_PREFIX}api/summary`] })
    } catch (error) {
      warn('web route registration failed:', describeError(error))
      void recordActivation({ route: 'failed', error: describeError(error) })
    }
  })
}
