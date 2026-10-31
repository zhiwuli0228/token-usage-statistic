/**
 * Pure value helpers for token-usage records.
 *
 * The durable ledger is the only source of truth in this project: every
 * aggregate is a fold over its records, so these functions stay free of I/O and
 * of any Harness dependency. They are the unit-test surface.
 *
 * A record is one committed `assistant/message` event that carries provider
 * usage. Its shape is deliberately plain JSON:
 *
 * ```json
 * {
 *   "version": 1,
 *   "time": 1788454310462,
 *   "day": "2026-10-31",
 *   "sessionId": "session-…",
 *   "seq": 42,
 *   "provider": "deepseek",
 *   "model": "deepseek-chat",
 *   "usage": {
 *     "inputTokens": 1200,
 *     "outputTokens": 340,
 *     "cacheReadTokens": 900,
 *     "cacheWriteTokens": 0,
 *     "reasoningTokens": 120,
 *     "totalTokens": 1540
 *   }
 * }
 * ```
 */

/** Bumped when the record shape or its meaning changes. */
export const RECORD_VERSION = 1

/**
 * Whether a value is a usable token count.
 *
 * Provider usage is untrusted JSON at the edge of this package: a negative,
 * fractional, `null` or string-encoded number must never poison a sum.
 *
 * @param {unknown} value - raw count from a usage object.
 * @returns {number} a non-negative integer, or 0.
 */
export function count(value) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number) || number <= 0) return 0
  return Math.round(number)
}

/**
 * A fresh zeroed counter block.
 *
 * `calls` counts committed assistant messages, not HTTP requests: a retried
 * attempt that never commits a message is not observable here and is not
 * counted.
 *
 * @returns {{ calls: number, inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheWriteTokens: number, reasoningTokens: number, totalTokens: number }}
 */
export function emptyTotals() {
  return {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
  }
}

/**
 * Clone a counter block, so callers can hand one out without aliasing a fold.
 *
 * @param {{ calls: number, inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheWriteTokens: number, reasoningTokens: number, totalTokens: number }} totals - block to copy.
 * @returns {{ calls: number, inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheWriteTokens: number, reasoningTokens: number, totalTokens: number }} a detached copy.
 */
export function cloneTotals(totals) {
  return {
    calls: count(totals?.calls),
    inputTokens: count(totals?.inputTokens),
    outputTokens: count(totals?.outputTokens),
    cacheReadTokens: count(totals?.cacheReadTokens),
    cacheWriteTokens: count(totals?.cacheWriteTokens),
    reasoningTokens: count(totals?.reasoningTokens),
    totalTokens: count(totals?.totalTokens),
  }
}

/**
 * Normalize one provider `TokenUsage` into this project's counter vocabulary.
 *
 * `totalTokens` keeps the provider's own number when it reports one; otherwise
 * it is input + output. Cache counters are not added to the total because the
 * providers this Harness speaks to report them as a subset of the input count.
 *
 * @param {unknown} usage - `assistant/message` data's `usage` field.
 * @returns {{ input: number, output: number, cacheRead: number, cacheWrite: number, reasoning: number, total: number }} normalized counts.
 */
export function normalizeUsage(usage) {
  const source = usage !== null && typeof usage === 'object' ? usage : {}
  const input = count(source.inputTokens)
  const output = count(source.outputTokens)
  const reportedTotal = count(source.totalTokens)
  return {
    input,
    output,
    cacheRead: count(source.cacheReadTokens),
    cacheWrite: count(source.cacheWriteTokens),
    reasoning: count(source.reasoningTokens),
    total: reportedTotal > 0 ? reportedTotal : input + output,
  }
}

/**
 * The counter contribution of exactly one committed call.
 *
 * @param {unknown} usage - provider usage.
 * @returns {{ calls: number, inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheWriteTokens: number, reasoningTokens: number, totalTokens: number }} one call's counters.
 */
export function totalsOfUsage(usage) {
  const normalized = normalizeUsage(usage)
  return {
    calls: 1,
    inputTokens: normalized.input,
    outputTokens: normalized.output,
    cacheReadTokens: normalized.cacheRead,
    cacheWriteTokens: normalized.cacheWrite,
    reasoningTokens: normalized.reasoning,
    totalTokens: normalized.total,
  }
}

/**
 * Add one counter block into another, in place.
 *
 * @param {{ calls: number, inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheWriteTokens: number, reasoningTokens: number, totalTokens: number }} into - destination block.
 * @param {{ calls: number, inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheWriteTokens: number, reasoningTokens: number, totalTokens: number }} from - source block.
 * @returns {typeof into} the destination, for chaining.
 */
export function addTotals(into, from) {
  into.calls += count(from?.calls)
  into.inputTokens += count(from?.inputTokens)
  into.outputTokens += count(from?.outputTokens)
  into.cacheReadTokens += count(from?.cacheReadTokens)
  into.cacheWriteTokens += count(from?.cacheWriteTokens)
  into.reasoningTokens += count(from?.reasoningTokens)
  into.totalTokens += count(from?.totalTokens)
  return into
}

/**
 * The bucket key of an instant in the Host process's local time zone.
 *
 * Day buckets are calendar days as the person using the machine sees them, not
 * UTC days: a late-evening call belongs to today, not to the UTC date that may
 * already be tomorrow.
 *
 * @param {number} time - epoch milliseconds.
 * @returns {string} `YYYY-MM-DD` in local time.
 */
export function localDayKey(time) {
  const date = new Date(Number.isFinite(time) ? time : Date.now())
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * The dedupe key of a record.
 *
 * A session's `seq` is unique and monotonic, so (session, seq) identifies one
 * committed event across replays of the ledger and any later backfill pass.
 *
 * @param {{ sessionId?: string, seq?: number, time?: number }} record - any record-like value.
 * @returns {string} a stable key.
 */
export function recordKey(record) {
  const sessionId = typeof record?.sessionId === 'string' ? record.sessionId : ''
  const seq = Number.isFinite(record?.seq) ? record.seq : undefined
  if (sessionId && seq !== undefined) return `${sessionId}#${seq}`
  return `${sessionId}#t${Number.isFinite(record?.time) ? record.time : 0}`
}

/**
 * Coerce an untrusted record (ledger line, collector output) into the canonical
 * shape, or reject it.
 *
 * Rejecting is the contract: a line that cannot name its session and carries no
 * usable usage must not be silently folded in as a zero-token call, because that
 * would inflate the call count without tokens.
 *
 * @param {unknown} value - candidate record.
 * @returns {null | { version: number, time: number, day: string, sessionId: string, seq?: number, provider: string, model: string, usage: { inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheWriteTokens: number, reasoningTokens: number, totalTokens: number } }} canonical record or null.
 */
export function sanitizeRecord(value) {
  if (value === null || typeof value !== 'object') return null
  const sessionId = typeof value.sessionId === 'string' && value.sessionId.length > 0 ? value.sessionId : undefined
  const usage = value.usage
  if (!sessionId || usage === null || typeof usage !== 'object') return null

  const inputTokens = count(usage.inputTokens)
  const outputTokens = count(usage.outputTokens)
  const cacheReadTokens = count(usage.cacheReadTokens)
  const cacheWriteTokens = count(usage.cacheWriteTokens)
  const reasoningTokens = count(usage.reasoningTokens)
  const reportedTotal = count(usage.totalTokens)
  const totalTokens = reportedTotal > 0 ? reportedTotal : inputTokens + outputTokens

  // A committed message without any tokens is not a useful call: it can happen
  // when a provider omits usage entirely and this plugin's normalizer defaulted
  // everything to zero. Keep it out of the ledger rather than count a no-op.
  if (inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens + reasoningTokens === 0) return null

  const time = Number.isFinite(value.time) ? value.time : Date.now()
  const provider = typeof value.provider === 'string' && value.provider.length > 0 ? value.provider : 'unknown'
  const model = typeof value.model === 'string' && value.model.length > 0 ? value.model : 'unknown'
  const seq = Number.isFinite(value.seq) ? value.seq : undefined

  return {
    version: RECORD_VERSION,
    time,
    day: typeof value.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.day) ? value.day : localDayKey(time),
    sessionId,
    ...(seq === undefined ? {} : { seq }),
    provider,
    model,
    usage: { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, reasoningTokens, totalTokens },
  }
}

/**
 * Build a canonical record from a committed assistant message.
 *
 * @param {{ time: number, sessionId: string, seq?: number, provider: string, model: string, usage: unknown }} input - collector output.
 * @returns {null | ReturnType<typeof sanitizeRecord>} the record, or null when nothing usable was reported.
 */
export function makeRecord(input) {
  const normalized = normalizeUsage(input?.usage)
  if (normalized.input + normalized.output + normalized.cacheRead + normalized.cacheWrite + normalized.reasoning === 0) {
    return null
  }
  return sanitizeRecord({
    version: RECORD_VERSION,
    time: input?.time,
    day: localDayKey(input?.time),
    sessionId: input?.sessionId,
    seq: input?.seq,
    provider: input?.provider,
    model: input?.model,
    usage: {
      inputTokens: normalized.input,
      outputTokens: normalized.output,
      cacheReadTokens: normalized.cacheRead,
      cacheWriteTokens: normalized.cacheWrite,
      reasoningTokens: normalized.reasoning,
      totalTokens: normalized.total,
    },
  })
}
