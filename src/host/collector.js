/**
 * The session-event reader.
 *
 * Two durable events matter:
 *
 *  - `request/header` carries the effective provider/model of the request
 *    envelope. It is remembered per session as a fallback attribution.
 *  - `assistant/message` carries `usage` when the provider reported it, and its
 *    message source normally names the exact provider/model route.
 *
 * The message source is authoritative when present; the remembered header covers
 * messages whose source is absent. Everything is keyed by session id because one
 * Host process serves many sessions concurrently.
 */

import { makeRecord } from './usage.js'

/**
 * Pick the first non-empty string.
 *
 * @param {...unknown} values - candidates, most authoritative first.
 * @returns {string} the first usable string, or `''`.
 */
function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) return value
  }
  return ''
}

/**
 * The header fallback table, bounded so a long-lived Host cannot leak one entry
 * per session it has ever seen.
 */
export class Collector {
  /**
   * @param {{ maxHeaders?: number }} [options] - fallback table bound.
   */
  constructor({ maxHeaders = 512 } = {}) {
    /** @type {Map<string, { provider: string, model: string }>} */
    this.headers = new Map()
    this.maxHeaders = Number.isFinite(maxHeaders) && maxHeaders > 0 ? Math.floor(maxHeaders) : 512
  }

  /**
   * Remember one session's effective request route.
   *
   * @param {string} sessionId - session identity.
   * @param {{ provider?: unknown, model?: unknown }} config - `request/header`'s `header.config`.
   * @returns {void}
   */
  remember(sessionId, config) {
    const provider = firstString(config?.provider)
    const model = firstString(config?.model)
    if (!provider || !model) return
    if (!this.headers.has(sessionId) && this.headers.size >= this.maxHeaders) {
      const oldest = this.headers.keys().next().value
      if (oldest !== undefined) this.headers.delete(oldest)
    }
    this.headers.set(sessionId, { provider, model })
  }

  /**
   * Forget one session's fallback route.
   *
   * @param {string | undefined} sessionId - session identity.
   * @returns {void}
   */
  forget(sessionId) {
    if (typeof sessionId === 'string') this.headers.delete(sessionId)
  }

  /**
   * Turn one committed session event into a usage record.
   *
   * @param {{ id?: string } | undefined} session - the owning session.
   * @param {{ type?: string, seq?: number, time?: number, data?: Record<string, any> } | undefined} event - the appended event.
   * @returns {null | ReturnType<typeof makeRecord>} the record, or null for events this plugin ignores.
   */
  observe(session, event) {
    if (session === null || session === undefined || typeof session !== 'object') return null
    if (event === null || event === undefined || typeof event !== 'object') return null
    const sessionId = firstString(session.id)
    if (!sessionId) return null

    if (event.type === 'request/header') {
      this.remember(sessionId, event.data?.header?.config)
      return null
    }
    if (event.type !== 'assistant/message') return null

    const data = event.data
    if (data === null || data === undefined || typeof data !== 'object') return null
    const usage = data.usage
    if (usage === null || usage === undefined || typeof usage !== 'object') return null

    const source = data.message?.source
    const header = this.headers.get(sessionId)
    const provider = firstString(source?.provider) || header?.provider || 'unknown'
    const model = firstString(source?.model) || header?.model || 'unknown'

    return makeRecord({
      time: Number.isFinite(event.time) ? event.time : Date.now(),
      sessionId,
      seq: Number.isFinite(event.seq) ? event.seq : undefined,
      provider,
      model,
      usage,
    })
  }
}
