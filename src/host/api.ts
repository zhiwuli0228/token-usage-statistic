/**
 * The read-only HTTP surface the browser half consumes.
 *
 * One exact route is registered under the plugin's own prefix. A `prefix`
 * registration is accepted by the Web carrier but never dispatched (verified on
 * the running Desktop build), so the route list is explicit.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

import type { BackfillStatus } from './types.js'
import type { UsageStore } from './store.js'

/** Prefix every route of this plugin lives under. */
export const API_PREFIX = '/token-usage-statistic/'
/** The one endpoint the panel reads. */
export const SUMMARY_PATH = `${API_PREFIX}api/summary`

/**
 * Parse `days`: a trailing window in calendar days, or null for all time.
 */
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

/** Write one JSON response. */
export function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  options: { method?: string; headers?: Record<string, string> } = {},
): void {
  if (typeof response.writeHead !== 'function' || typeof response.end !== 'function') return
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
    ...(options.headers ?? {}),
  })
  if (options.method === 'HEAD') {
    response.end()
    return
  }
  response.end(payload)
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
      sendJson(response, 400, { error: 'bad-request' }, { method })
      return
    }

    if (url.pathname !== SUMMARY_PATH) {
      sendJson(response, 404, { error: 'not-found', path: url.pathname }, { method })
      return
    }
    if (method !== 'GET' && method !== 'HEAD') {
      sendJson(response, 405, { error: 'method-not-allowed' }, { method, headers: { allow: 'GET, HEAD' } })
      return
    }

    try {
      const days = parseDays(url.searchParams.get('days'))
      const sessionLimit = parseLimit(url.searchParams.get('sessions'), 12, 100)
      const recentLimit = parseLimit(url.searchParams.get('recent'), 20, 100)
      const snapshot = dependencies.store.snapshot({
        days,
        sessionLimit,
        recentLimit,
        now: now(),
        backfill: dependencies.backfill() ?? IDLE_BACKFILL,
        refreshMs: dependencies.refreshMs,
      })
      sendJson(response, 200, snapshot, { method })
    } catch (error) {
      sendJson(
        response,
        500,
        { error: 'internal', message: error instanceof Error ? error.message : String(error) },
        { method },
      )
    }
  }
}
