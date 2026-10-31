/**
 * The HTTP surface the browser half reads.
 *
 * A plain route on the Web carrier is used instead of a generated Remote
 * namespace: this package is plain JavaScript with no build step, and the panel
 * only reads one JSON document. The route lives under its own prefix so it can
 * never shadow a shipped path.
 */

/** Prefix every route of this plugin lives under. */
export const API_PREFIX = '/token-usage-statistic/'

/**
 * Parse the `days` query parameter.
 *
 * @param {string | null} value - raw parameter.
 * @param {number} fallback - window used when the parameter is absent.
 * @returns {number | null} a trailing window in days, or null for all time.
 */
export function parseDays(value, fallback = 30) {
  if (value === null || value === '') return fallback
  if (value === 'all') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(Math.floor(parsed), 3650)
}

/**
 * Parse one bounded positive integer query parameter.
 *
 * @param {string | null} value - raw parameter.
 * @param {number} fallback - value used when absent or invalid.
 * @param {number} max - upper bound.
 * @returns {number} the bounded value.
 */
export function parseLimit(value, fallback, max) {
  if (value === null || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(Math.floor(parsed), max)
}

/**
 * Write one JSON response.
 *
 * @param {import('node:http').ServerResponse} response - response to write.
 * @param {number} status - HTTP status.
 * @param {unknown} body - JSON-serializable body.
 * @param {{ method?: string, headers?: Record<string, string> }} [options] - request method and extra headers.
 * @returns {void}
 */
export function sendJson(response, status, body, { method = 'GET', headers = {} } = {}) {
  if (!response || typeof response.writeHead !== 'function' || typeof response.end !== 'function') return
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
    ...headers,
  })
  if (method === 'HEAD') {
    response.end()
    return
  }
  response.end(payload)
}

/**
 * Build the route handler.
 *
 * @param {{ store: { snapshot: (options: object) => Record<string, unknown> }, config?: Record<string, unknown>, now?: () => number }} options - dependencies.
 * @returns {(request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => void} the handler.
 */
export function createHttpHandler({ store, config = {}, now = () => Date.now() }) {
  return function handle(request, response) {
    const method = typeof request?.method === 'string' ? request.method : 'GET'
    let url
    try {
      url = new URL(typeof request?.url === 'string' ? request.url : '/', 'http://localhost')
    } catch {
      sendJson(response, 400, { error: 'bad-request' }, { method })
      return
    }

    if (url.pathname !== `${API_PREFIX}api/summary`) {
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
      const body = store.snapshot({ days, sessionLimit, recentLimit, now: now() })
      body.config = {
        refreshMs: Number.isFinite(config.refreshMs) ? config.refreshMs : 15000,
      }
      sendJson(response, 200, body, { method })
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
