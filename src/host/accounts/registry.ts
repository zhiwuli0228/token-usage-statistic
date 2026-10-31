/**
 * The account registry: discovery, refresh scheduling and cached snapshots.
 *
 * Discovery is capability-driven: the DSH Desktop account service, the official
 * DeepSeek API-key route, and every `llm-pi-ai` provider profile are inspected;
 * explicit config monitors extend or override the result. A provider with no
 * public balance/plan interface is listed as `unsupported` and never queried.
 *
 * Credentials are resolved per refresh inside the Host and never enter a
 * snapshot; the panel only sees normalized numbers and coarse error codes.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { GenericBalanceMapping, GenericSubscriptionMapping } from './schemes.js'
import { AccountError, fetchJson, type FetchJson } from './net.js'
import {
  numberOrNull,
  parseGenericBalance,
  parseGenericSubscription,
  parseSchemeBalance,
  schemeForProvider,
  schemeURL,
  stringOrNull,
  type BalanceSchemeId,
} from './schemes.js'
import type { AccountBalance, AccountMode, AccountStatus, AccountSubscription, AccountView, AccountsPayload } from './types.js'

/** One explicitly configured monitor. */
export interface AccountMonitorConfig {
  id: string
  displayName?: string
  mode: AccountMode
  baseURL: string
  credentialRef?: string
  scheme?: BalanceSchemeId
  headers?: Record<string, string>
  balance?: GenericBalanceMapping
  subscription?: GenericSubscriptionMapping
  timeoutMs?: number
}

/** Resolved account settings. */
export interface AccountsConfig {
  refreshMs: number
  timeoutMs: number
  monitors: AccountMonitorConfig[]
}

interface AccountDefinition {
  id: string
  displayName: string
  mode: AccountMode
  adapter: 'host' | 'http' | 'unsupported'
  baseURL?: string
  credentialRef?: string
  scheme?: BalanceSchemeId
  headers?: Record<string, string>
  balance?: GenericBalanceMapping
  subscription?: GenericSubscriptionMapping
  timeoutMs?: number
  reason?: string
}

/** The services discovery reads; all optional so headless profiles activate. */
export interface AccountServices {
  get(name: string): unknown
}

export interface AccountRegistryOptions {
  services: AccountServices
  dataDir: string
  config: AccountsConfig
  version: string
  fetchImpl?: FetchJson
  now?: () => number
  log?: (message: string) => void
}

interface CacheFile {
  version: 1
  updatedAt: number
  accounts: AccountView[]
}

const MIN_REFRESH_MS = 60_000

function clampRefresh(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= MIN_REFRESH_MS ? Math.floor(value) : fallback
}

function emptyAccount(definition: AccountDefinition): AccountView {
  return {
    id: definition.id,
    displayName: definition.displayName,
    mode: definition.mode,
    adapter: definition.adapter,
    configured: false,
    status: 'unconfigured',
    stale: false,
    fetchedAt: null,
    lastAttemptAt: null,
    lastError: null,
    source: { kind: definition.adapter === 'host' ? 'host-service' : definition.adapter === 'http' ? 'http' : 'unsupported', ...(definition.baseURL === undefined ? {} : { origin: definition.baseURL }) },
  }
}

function walletNumber(value: unknown): number | null {
  return numberOrNull(value)
}

/** Merge a host-account query into a normalized balance. */
function balanceOfWallets(wallets: readonly unknown[], bonus: readonly unknown[]): AccountBalance {
  const sums = new Map<string, { total: number; granted: number }>()
  const add = (entries: readonly unknown[], key: 'total' | 'granted') => {
    for (const entry of entries) {
      if (entry === null || typeof entry !== 'object') continue
      const record = entry as Record<string, unknown>
      const currency = stringOrNull(record.currency) ?? 'CNY'
      const amount = walletNumber(record.balance) ?? 0
      const current = sums.get(currency) ?? { total: 0, granted: 0 }
      current[key] += amount
      sums.set(currency, current)
    }
  }
  add(wallets, 'total')
  add(bonus, 'granted')
  const entry = [...sums.entries()].find(([currency]) => currency === 'CNY') ?? [...sums.entries()][0]
  if (entry === undefined) return { currency: null, total: null, used: null, limit: null, granted: null, toppedUp: null, available: null }
  const [currency, value] = entry
  const total = value.total + value.granted
  return {
    currency,
    total,
    used: null,
    limit: null,
    granted: value.granted,
    toppedUp: value.total,
    available: total > 0,
  }
}

/** Dynamic account registry. */
export class AccountRegistry {
  private readonly options: AccountRegistryOptions
  private readonly now: () => number
  private views = new Map<string, AccountView>()
  private definitions: AccountDefinition[] = []
  private refreshing = false
  private disposed = false
  private timer: ReturnType<typeof setInterval> | undefined
  private firstTimer: ReturnType<typeof setTimeout> | undefined

  constructor(options: AccountRegistryOptions) {
    this.options = options
    this.now = options.now ?? Date.now
    this.options.config = {
      ...options.config,
      refreshMs: clampRefresh(options.config.refreshMs, 600_000),
    }
  }

  /** Load the previous snapshot so the panel has data before the first query. */
  async loadCache(): Promise<void> {
    try {
      const text = await readFile(path.join(this.options.dataDir, 'accounts.json'), 'utf8')
      const parsed = JSON.parse(text) as Partial<CacheFile>
      if (parsed.version !== 1 || !Array.isArray(parsed.accounts)) return
      for (const account of parsed.accounts) {
        if (account !== null && typeof account === 'object' && typeof account.id === 'string') {
          this.views.set(account.id, { ...account, stale: account.fetchedAt !== null })
        }
      }
    } catch {
      /* a missing or unreadable cache just means the first refresh is the first data */
    }
  }

  /** Whether a refresh cycle is running. */
  isRefreshing(): boolean {
    return this.refreshing
  }

  /** The wire snapshot. */
  snapshot(): AccountsPayload {
    const order = this.definitions.length > 0 ? this.definitions.map((entry) => entry.id) : [...this.views.keys()]
    const accounts = order.map((id) => this.views.get(id)).filter((entry): entry is AccountView => entry !== undefined)
    for (const view of this.views.values()) if (!order.includes(view.id)) accounts.push(view)
    return {
      schemaVersion: 1,
      generatedAt: this.now(),
      refreshMs: this.options.config.refreshMs,
      refreshing: this.refreshing,
      accounts,
    }
  }

  /** Refresh every account once; concurrent calls share the running cycle. */
  async refresh(): Promise<void> {
    if (this.refreshing || this.disposed) return
    this.refreshing = true
    try {
      const definitions = await this.discover()
      this.definitions = definitions
      for (const definition of definitions) {
        if (!this.views.has(definition.id)) this.views.set(definition.id, emptyAccount(definition))
      }
      await Promise.all(definitions.map((definition) => this.queryOne(definition)))
      await this.persist()
    } finally {
      this.refreshing = false
    }
  }

  /** Start the initial and periodic refresh; returns its disposer. */
  start(): () => void {
    const schedule = (): void => {
      if (this.disposed) return
      void this.refresh()
    }
    this.firstTimer = setTimeout(schedule, 1500)
    this.timer = setInterval(schedule, this.options.config.refreshMs)
    return () => {
      this.disposed = true
      if (this.firstTimer !== undefined) clearTimeout(this.firstTimer)
      if (this.timer !== undefined) clearInterval(this.timer)
    }
  }

  private async discover(): Promise<AccountDefinition[]> {
    const definitions: AccountDefinition[] = []
    const explicit = new Map(this.options.config.monitors.map((monitor) => [monitor.id, monitor]))

    // DSH Desktop account (host-owned). Always listed: signed out is a
    // meaningful state the panel should explain rather than hide.
    if (this.options.services.get('deepseekAccount') !== undefined) {
      definitions.push({
        id: 'deepseek-account',
        displayName: 'DeepSeek Account',
        mode: 'balance',
        adapter: 'host',
      })
    }

    const settings = this.options.services.get('settings') as
      | { describe?: (options?: { redactSecrets?: boolean }) => Array<{ ns: string; value: unknown }> }
      | undefined
    if (settings !== undefined && typeof settings.describe === 'function') {
      let descriptors: Array<{ ns: string; value: unknown }> = []
      try {
        descriptors = settings.describe({ redactSecrets: true })
      } catch {
        descriptors = []
      }

      const piAI = descriptors.find((entry) => String(entry.ns).endsWith('llm-pi-ai'))
      const providers = piAI?.value !== null && typeof piAI?.value === 'object'
        ? (piAI.value as { providers?: unknown }).providers
        : undefined
      if (providers !== null && typeof providers === 'object' && !Array.isArray(providers)) {
        for (const [id, raw] of Object.entries(providers as Record<string, unknown>)) {
          if (raw === null || typeof raw !== 'object') continue
          const profile = raw as Record<string, unknown>
          const baseURL = stringOrNull(profile.baseURL) ?? undefined
          const credentialRef = stringOrNull(profile.apiKeyEnv) ?? undefined
          const displayName = stringOrNull(profile.displayName) ?? id
          const scheme = schemeForProvider(id, baseURL)
          definitions.push(
            scheme === null
              ? {
                  id,
                  displayName,
                  mode: 'balance',
                  adapter: 'unsupported',
                  baseURL,
                  credentialRef,
                  reason: 'no public balance interface',
                }
              : { id, displayName, mode: 'balance', adapter: 'http', baseURL, credentialRef, scheme },
          )
        }
      }

      const deepseek = descriptors.find((entry) => String(entry.ns).endsWith('llm-deepseek'))
      if (deepseek !== undefined) {
        const value = deepseek.value !== null && typeof deepseek.value === 'object' ? (deepseek.value as Record<string, unknown>) : {}
        definitions.push({
          id: 'deepseek-api',
          displayName: 'DeepSeek API',
          mode: 'balance',
          adapter: 'http',
          baseURL: stringOrNull(value.baseURL) ?? 'https://api.deepseek.com',
          credentialRef: stringOrNull(value.apiKeyEnv) ?? 'DEEPSEEK_API_KEY',
          scheme: 'deepseek',
        })
      }
    }

    for (const monitor of explicit.values()) {
      const index = definitions.findIndex((entry) => entry.id === monitor.id)
      const definition: AccountDefinition = {
        id: monitor.id,
        displayName: monitor.displayName ?? monitor.id,
        mode: monitor.mode,
        adapter: 'http',
        baseURL: monitor.baseURL,
        credentialRef: monitor.credentialRef,
        scheme: monitor.scheme ?? schemeForProvider(monitor.id, monitor.baseURL) ?? undefined,
        headers: monitor.headers,
        balance: monitor.balance,
        subscription: monitor.subscription,
        timeoutMs: monitor.timeoutMs,
      }
      if (index >= 0) definitions[index] = definition
      else definitions.push(definition)
    }

    const seen = new Set<string>()
    return definitions.filter((entry) => {
      if (seen.has(entry.id)) return false
      seen.add(entry.id)
      return true
    })
  }

  private async queryOne(definition: AccountDefinition): Promise<void> {
    const previous = this.views.get(definition.id)
    const now = this.now()
    const base = previous ?? emptyAccount(definition)
    const started: AccountView = { ...base, adapter: definition.adapter, mode: definition.mode, lastAttemptAt: now }

    try {
      const outcome = await this.query(definition)
      if (outcome === 'unconfigured') {
        this.views.set(definition.id, {
          ...started,
          configured: false,
          status: 'unconfigured',
          stale: false,
          lastError: null,
        })
        return
      }
      if (outcome === 'unsupported') {
        this.views.set(definition.id, {
          ...started,
          configured: false,
          status: 'unsupported',
          stale: false,
          lastError: definition.reason ?? null,
        })
        return
      }
      this.views.set(definition.id, {
        ...started,
        configured: true,
        status: 'ok',
        stale: false,
        fetchedAt: now,
        lastError: null,
        ...outcome,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.options.log?.(`account ${definition.id} refresh failed: ${message}`)
      this.views.set(definition.id, {
        ...started,
        status: 'error',
        stale: previous?.fetchedAt !== null && previous?.fetchedAt !== undefined,
        lastError: message,
      })
    }
  }

  private async query(
    definition: AccountDefinition,
  ): Promise<'unconfigured' | 'unsupported' | { balance?: AccountBalance; subscription?: AccountSubscription }> {
    if (definition.adapter === 'unsupported') return 'unsupported'
    if (definition.adapter === 'host') return this.queryHost()
    return this.queryHTTP(definition)
  }

  private async queryHost(): Promise<'unconfigured' | 'unsupported' | { balance: AccountBalance }> {
    const service = this.options.services.get('deepseekAccount') as
      | {
          getState: () => Promise<{ status?: string }>
          getBalance: (client: { version: string; locale: string; timezoneOffsetSeconds: number }) => Promise<
            | { status: 'ready'; value: readonly unknown[]; bonusWallets?: readonly unknown[] }
            | { status: 'failed' }
            | null
          >
        }
      | undefined
    if (service === undefined) return 'unsupported'
    const state = await service.getState()
    if (state?.status !== 'credential-stored') return 'unconfigured'
    const balance = await service.getBalance({
      version: this.options.version,
      locale: 'en',
      timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
    })
    if (balance === null) return 'unconfigured'
    if (balance.status !== 'ready') throw new AccountError('account-failed', 'the DeepSeek account balance query failed')
    return { balance: balanceOfWallets(balance.value ?? [], balance.bonusWallets ?? []) }
  }

  private async queryHTTP(
    definition: AccountDefinition,
  ): Promise<'unconfigured' | 'unsupported' | { balance?: AccountBalance; subscription?: AccountSubscription }> {
    if (definition.baseURL === undefined || definition.baseURL === '') {
      throw new AccountError('invalid-config', 'account monitor has no baseURL')
    }
    const credentials = this.options.services.get('credentials') as
      | { resolve: (ref: string) => Promise<{ value: string } | undefined>; describe: (ref: string) => Promise<{ configured: boolean }> }
      | undefined

    let apiKey: string | undefined
    if (definition.credentialRef !== undefined && definition.credentialRef !== '') {
      if (credentials === undefined) return 'unconfigured'
      const info = await credentials.describe(definition.credentialRef)
      if (!info.configured) return 'unconfigured'
      const resolved = await credentials.resolve(definition.credentialRef)
      if (resolved === undefined || resolved.value === '') return 'unconfigured'
      apiKey = resolved.value
    }

    const headers: Record<string, string> = { ...(definition.headers ?? {}) }
    if (apiKey !== undefined) headers.authorization = `Bearer ${apiKey}`

    if (definition.mode === 'subscription') {
      if (definition.subscription === undefined) return 'unsupported'
      const json = await fetchJson(definition.baseURL, { headers, timeoutMs: definition.timeoutMs ?? this.options.config.timeoutMs }, this.options.fetchImpl)
      return { subscription: parseGenericSubscription(json, definition.subscription) }
    }

    const url = definition.scheme === undefined ? definition.baseURL : schemeURL(definition.scheme, definition.baseURL)
    const json = await fetchJson(url, { headers, timeoutMs: definition.timeoutMs ?? this.options.config.timeoutMs }, this.options.fetchImpl)
    const balance = definition.scheme === undefined
      ? definition.balance === undefined
        ? undefined
        : parseGenericBalance(json, definition.balance)
      : parseSchemeBalance(definition.scheme, json)
    if (balance === undefined) return 'unsupported'
    return { balance }
  }

  private async persist(): Promise<void> {
    const file = path.join(this.options.dataDir, 'accounts.json')
    const payload: CacheFile = { version: 1, updatedAt: this.now(), accounts: this.snapshot().accounts }
    try {
      await mkdir(this.options.dataDir, { recursive: true })
      await writeFile(file, `${JSON.stringify(payload)}\n`, 'utf8')
    } catch (error) {
      this.options.log?.(`account cache could not be written: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

/** An empty payload for deployments where the registry never started. */
export function emptyAccountsPayload(refreshMs = 600_000): AccountsPayload {
  return { schemaVersion: 1, generatedAt: Date.now(), refreshMs, refreshing: false, accounts: [] }
}

/** Coerce the config monitors list defensively. */
export function readMonitors(value: unknown): AccountMonitorConfig[] {
  if (!Array.isArray(value)) return []
  const monitors: AccountMonitorConfig[] = []
  for (const raw of value) {
    if (raw === null || typeof raw !== 'object') continue
    const record = raw as Record<string, unknown>
    const id = stringOrNull(record.id)
    const baseURL = stringOrNull(record.baseURL)
    const mode = record.mode === 'subscription' ? 'subscription' : 'balance'
    if (id === null || baseURL === null) continue
    monitors.push({
      id,
      mode,
      baseURL,
      ...(stringOrNull(record.displayName) === null ? {} : { displayName: stringOrNull(record.displayName) as string }),
      ...(stringOrNull(record.credentialRef) === null ? {} : { credentialRef: stringOrNull(record.credentialRef) as string }),
      ...(record.scheme === 'deepseek' || record.scheme === 'moonshot' || record.scheme === 'zai' || record.scheme === 'openrouter' || record.scheme === 'orcarouter'
        ? { scheme: record.scheme }
        : {}),
      ...(record.headers !== null && typeof record.headers === 'object' ? { headers: record.headers as Record<string, string> } : {}),
      ...(record.balance !== null && typeof record.balance === 'object' ? { balance: record.balance as GenericBalanceMapping } : {}),
      ...(record.subscription !== null && typeof record.subscription === 'object' ? { subscription: record.subscription as GenericSubscriptionMapping } : {}),
      ...(numberOrNull(record.timeoutMs) === null ? {} : { timeoutMs: numberOrNull(record.timeoutMs) as number }),
    })
  }
  return monitors
}

/** Account status ordering for stable panel output. */
export const ACCOUNT_STATUS_ORDER: AccountStatus[] = ['error', 'ok', 'unconfigured', 'unsupported']
