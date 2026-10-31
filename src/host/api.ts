/**
 * The local HTTP surface.
 *
 * Every route is exact (the Web carrier accepts but never dispatches `prefix`
 * registrations), read-only, loopback-only and `no-store`. Account and export
 * routes never echo a credential: accounts come from normalized snapshots and
 * exports copy an allow-list.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

import type { AccountsPayload, BudgetState } from './accounts/types.js'
import { dailyCsv, jsonExport, sessionsCsv } from './export.js'
import type { UsageStore } from './store.js'
import type { BackfillStatus } from './types.js'

/** Prefix every route of this plugin lives under. */
export const API_PREFIX = '/token-usage-statistic/'

/** Every route, in one place so the client and tests share the spelling. */
export const ROUTES = {
  summary: `${API_PREFIX}api/summary`,
  accounts: `${API_PREFIX}api/accounts`,
  daily: `${API_PREFIX}api/daily`,
  exportDaily: `${API_PREFIX}api/export/daily.csv`,
  exportSessions: `${API_PREFIX}api/export/sessions.csv`,
  exportJson: `${API_PREFIX}api/export.json`,
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]

/** Parse `days`: a trailing window in calendar days, or null for all time. */
export function parseDays(value: string | null, fallback = 30): number | null {
  if (value === null || value === '') return fallback
  if (value === 'all') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(Math.floor(parsed), 3650)
}

/** Parse one bounded positive integer parameter. */
export function parseLimit(value: string | null, fallback: number, max: number): number {
  if (value === null || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(Math.floor(parsed), max)
}

/**
 * Only loopback peers may read this plugin's routes.
 *
 * An absent socket (in-process dispatch, unit tests) is treated as trusted:
 * the check exists to reject remote peers, not to invent one.
 */
export function isLoopbackRequest(request: IncomingMessage): boolean {
  const address = request.socket?.remoteAddress
  if (typeof address !== 'string' || address === '') return true
  return address === '::1' || address.startsWith('127.') || address.startsWith('::ffff:127.')
}

function writeHeaders(response: ServerResponse, status: number, headers: Record<string, string>): void {
  response.writeHead(status, headers)
}

/** Write one JSON response. */
export function sendJson(response: ServerResponse, status: number, body: unknown, method = 'GET'): void {
  const payload = JSON.stringify(body)
  writeHeaders(response, status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': String(Buffer.byteLength(payload)),
  })
  response.end(method === 'HEAD' ? undefined : payload)
}

/** Write one download response. */
export function sendDownload(
  response: ServerResponse,
  contentType: string,
  filename: string,
  payload: string,
  method = 'GET',
): void {
  writeHeaders(response, 200, {
    'content-type': contentType,
    'cache-control': 'no-store',
    'content-disposition': `attachment; filename="${filename}"`,
    'content-length': String(Buffer.byteLength(payload)),
  })
  response.end(method === 'HEAD' ? undefined : payload)
}

/** Idle backfill status used before the historical scan is wired. */
export const IDLE_BACKFILL: BackfillStatus = {
  state: 'idle',
  sessions: 0,
  events: 0,
  skipped: 0,
  inherited: 0,
  startedAt: null,
  finishedAt: null,
  error: null,
}

export interface ApiDependencies {
  store: UsageStore
  backfill: () => BackfillStatus
  accounts: () => AccountsPayload
  budgets: (now: number) => BudgetState
  refreshAccounts: () => void
  refreshMs: number
  now?: () => number
}

/** Build the route handler. */
export function createHttpHandler(dependencies: ApiDependencies): (request: IncomingMessage, response: ServerResponse) => void {
  const now = dependencies.now ?? Date.now
  return function handle(request, response): void {
    const method = typeof request.method === 'string' ? request.method : 'GET'
    let url: URL
    try {
      url = new URL(typeof request.url === 'string' ? request.url : '/', 'http://localhost')
    } catch {
      sendJson(response, 400, { error: 'bad-request' }, method)
      return
    }

    if (!isLoopbackRequest(request)) {
      sendJson(response, 403, { error: 'loopback-only' }, method)
      return
    }
    if (method !== 'GET' && method !== 'HEAD') {
      sendJson(response, 405, { error: 'method-not-allowed' }, method)
      return
    }

    try {
      switch (url.pathname) {
        case ROUTES.summary: {
          const snapshot = dependencies.store.snapshot({
            days: parseDays(url.searchParams.get('days')),
            sessionLimit: parseLimit(url.searchParams.get('sessions'), 12, 100),
            recentLimit: parseLimit(url.searchParams.get('recent'), 20, 100),
            now: now(),
            backfill: dependencies.backfill(),
            budgets: dependencies.budgets(now()),
            refreshMs: dependencies.refreshMs,
          })
          sendJson(response, 200, snapshot, method)
          return
        }
        case ROUTES.accounts: {
          if (url.searchParams.get('refresh') === '1') dependencies.refreshAccounts()
          sendJson(response, 200, dependencies.accounts(), method)
          return
        }
        case ROUTES.daily: {
          const snapshot = dependencies.store.dailyDetails({
            days: parseDays(url.searchParams.get('days')),
            sessionLimit: parseLimit(url.searchParams.get('sessions'), 12, 100),
            now: now(),
          })
          sendJson(response, 200, snapshot, method)
          return
        }
        case ROUTES.exportDaily: {
          sendDownload(response, 'text/csv; charset=utf-8', 'token-usage-daily.csv', dailyCsv(dependencies.store), method)
          return
        }
        case ROUTES.exportSessions: {
          sendDownload(response, 'text/csv; charset=utf-8', 'token-usage-sessions.csv', sessionsCsv(dependencies.store), method)
          return
        }
        case ROUTES.exportJson: {
          const body = jsonExport({
            store: dependencies.store,
            accounts: dependencies.accounts().accounts,
            budgets: dependencies.budgets(now()),
            exportedAt: now(),
          })
          sendJson(response, 200, body, method)
          return
        }
        default:
          sendJson(response, 404, { error: 'not-found', path: url.pathname }, method)
      }
    } catch (error) {
      sendJson(response, 500, { error: 'internal', message: error instanceof Error ? error.message : String(error) }, method)
    }
  }
}
