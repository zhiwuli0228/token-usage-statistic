/**
 * Pure token-usage primitives and event sampling.
 *
 * A sample is taken wherever the provider reports `usage`:
 *
 *  - `assistant/message` (a committed step) — `data.usage`;
 *  - `assistant/chunk` (a live usage chunk) — `data.chunk.type === 'usage'`;
 *  - `compaction/summary` (a summary call) — `data.usage`.
 *
 * Assistant samples are keyed by `turn:step`: a later report for the same step
 * replaces the earlier one rather than adding to it. Compaction samples are
 * keyed by their own id, so they never collide with the assistant cursor.
 */

import type { Buckets, RawUsage, SampleKind, UsageSample } from './types.js'

/** A usable non-negative integer token count. */
export function count(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number) || number <= 0) return 0
  return Math.round(number)
}

/** Local-calendar `YYYY-MM-DD` for an epoch millisecond. */
export function dayKey(time: number): string {
  const date = new Date(Number.isFinite(time) ? time : Date.now())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** A fresh zeroed bucket set. */
export function emptyBuckets(): Buckets {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
}

/** Normalize untrusted provider usage into buckets. */
export function bucketsOf(usage: RawUsage | undefined): Buckets {
  const source = usage !== null && typeof usage === 'object' ? usage : {}
  return {
    input: count(source.inputTokens),
    output: count(source.outputTokens),
    cacheRead: count(source.cacheReadTokens),
    cacheWrite: count(source.cacheWriteTokens),
  }
}

/**
 * Total tokens across every bucket.
 *
 * DeepSeek's own reported `totalTokens` equals input + output + cacheRead +
 * cacheWrite (cache hits are reported separately from the miss-only input
 * count), so this sum is the number users see in provider dashboards.
 */
export function totalTokens(buckets: Buckets): number {
  return buckets.input + buckets.output + buckets.cacheRead + buckets.cacheWrite
}

/** Add one bucket set into another, in place. */
export function addBuckets(into: Buckets, from: Buckets): Buckets {
  into.input += from.input
  into.output += from.output
  into.cacheRead += from.cacheRead
  into.cacheWrite += from.cacheWrite
  return into
}

/** Subtract one bucket set from another, in place. */
export function subtractBuckets(into: Buckets, from: Buckets): Buckets {
  into.input -= from.input
  into.output -= from.output
  into.cacheRead -= from.cacheRead
  into.cacheWrite -= from.cacheWrite
  return into
}

/**
 * Prompt-side cache hit rate in percent (0–100, one decimal), or null when the
 * prompt side reported nothing at all.
 */
export function cacheHitRate(buckets: Buckets): number | null {
  const prompt = buckets.input + buckets.cacheRead + buckets.cacheWrite
  if (prompt <= 0) return null
  return Math.round((buckets.cacheRead / prompt) * 1000) / 10
}

/** Whether a bucket set carries any tokens at all. */
export function hasTokens(buckets: Buckets): boolean {
  return totalTokens(buckets) > 0
}

/** One sample's contribution before pricing. */
export interface SampleDraft {
  key: string
  kind: SampleKind
  usage: RawUsage
}

/**
 * The usage report an event carries, if any.
 *
 * Shape is read defensively: older and newer Harness generations differ in
 * which event carries live usage, and an event this version does not know must
 * be ignored rather than crash the collector.
 */
export function sampleDraftOf(event: EventLike | undefined): SampleDraft | null {
  if (event === null || typeof event !== 'object') return null
  const data = event.data as Record<string, any> | undefined
  if (data === undefined || data === null || typeof data !== 'object') return null

  if (event.type === 'assistant/chunk') {
    const chunk = data.chunk
    if (chunk === null || typeof chunk !== 'object' || chunk.type !== 'usage') return null
    if (chunk.usage === null || typeof chunk.usage !== 'object') return null
    return { key: `${Number(data.turn)}:${Number(data.step)}`, kind: 'assistant', usage: chunk.usage }
  }

  if (event.type === 'assistant/message') {
    if (data.usage === null || data.usage === undefined || typeof data.usage !== 'object') return null
    return { key: `${Number(data.turn)}:${Number(data.step)}`, kind: 'assistant', usage: data.usage }
  }

  if (event.type === 'compaction/summary') {
    if (data.usage === null || data.usage === undefined || typeof data.usage !== 'object') return null
    const id = typeof data.compactionId === 'string' && data.compactionId.length > 0 ? data.compactionId : String(event.seq)
    return { key: `compaction:${id}`, kind: 'compaction', usage: data.usage }
  }

  return null
}

/** The minimal event shape this plugin reads; the Session's own type is wider. */
export interface EventLike {
  type: string
  seq: number
  time: number
  data?: unknown
}

/** Provider/model attribution read from one event, most authoritative first. */
export interface RouteIdentity {
  provider: string
  model: string
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return ''
}

/**
 * Resolve the route an event names.
 *
 * `assistant/message` carries the source on its message; a compaction summary
 * names provider/model directly; a usage chunk falls back to the remembered
 * `request/header` route.
 */
export function routeOf(event: EventLike | undefined): RouteIdentity | null {
  if (event === null || typeof event !== 'object') return null
  const data = event.data as Record<string, any> | undefined
  if (data === undefined || data === null || typeof data !== 'object') return null

  const source = data.message?.source
  const sourceProvider = firstString(source?.provider)
  const sourceModel = firstString(source?.model)
  if (sourceModel !== '') return { provider: sourceProvider || 'unknown', model: sourceModel }

  const directProvider = firstString(data.provider)
  const directModel = firstString(data.model)
  if (directModel !== '') return { provider: directProvider || 'unknown', model: directModel }

  const config = data.header?.config
  const headerProvider = firstString(config?.provider)
  const headerModel = firstString(config?.model)
  if (headerModel !== '') return { provider: headerProvider || 'unknown', model: headerModel }

  return null
}

/** Build one canonical sample, or null when the report carries no tokens. */
export function makeSample(input: {
  sessionId: string
  seq: number
  time: number
  key: string
  kind: SampleKind
  provider: string
  model: string
  usage: RawUsage
}): UsageSample | null {
  const buckets = bucketsOf(input.usage)
  if (!hasTokens(buckets)) return null
  const seq = Number.isFinite(input.seq) ? Math.floor(input.seq) : -1
  if (seq < 0) return null
  const time = Number.isFinite(input.time) ? input.time : Date.now()
  return {
    version: 2,
    sessionId: input.sessionId,
    seq,
    time,
    day: dayKey(time),
    sampleKey: input.key,
    kind: input.kind,
    provider: input.provider || 'unknown',
    model: input.model || 'unknown',
    buckets,
  }
}

/** Whether a value looks like a v2 sample. */
function isV2(value: Record<string, any>): boolean {
  return value.version === 2 && typeof value.sampleKey === 'string' && typeof value.kind === 'string'
}

/**
 * Coerce one ledger line into a sample.
 *
 * Ledger lines written by the first JavaScript release (v1) have no
 * `sampleKey`/`kind`/`buckets`: they recorded one committed message per line,
 * so they migrate to a unique `assistant:<seq>` sample key without changing
 * their accounting.
 */
export function sanitizeSample(raw: unknown): UsageSample | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Record<string, any>
  const sessionId = typeof value.sessionId === 'string' && value.sessionId.length > 0 ? value.sessionId : ''
  if (sessionId === '') return null
  const seq = Number.isFinite(value.seq) ? Math.floor(value.seq) : -1
  if (seq < 0) return null
  const time = Number.isFinite(value.time) ? value.time : Date.now()

  if (isV2(value)) {
    const buckets = value.buckets
    if (buckets === null || typeof buckets !== 'object') return null
    const normalized: Buckets = {
      input: count(buckets.input),
      output: count(buckets.output),
      cacheRead: count(buckets.cacheRead),
      cacheWrite: count(buckets.cacheWrite),
    }
    if (!hasTokens(normalized)) return null
    return {
      version: 2,
      sessionId,
      seq,
      time,
      day: typeof value.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.day) ? value.day : dayKey(time),
      sampleKey: value.sampleKey,
      kind: value.kind === 'compaction' ? 'compaction' : 'assistant',
      provider: typeof value.provider === 'string' && value.provider.length > 0 ? value.provider : 'unknown',
      model: typeof value.model === 'string' && value.model.length > 0 ? value.model : 'unknown',
      buckets: normalized,
    }
  }

  const usage = value.usage
  if (usage === null || typeof usage !== 'object') return null
  const buckets = bucketsOf(usage as RawUsage)
  if (!hasTokens(buckets)) return null
  return {
    version: 2,
    sessionId,
    seq,
    time,
    day: typeof value.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.day) ? value.day : dayKey(time),
    sampleKey: `assistant:${seq}`,
    kind: 'assistant',
    provider: typeof value.provider === 'string' && value.provider.length > 0 ? value.provider : 'unknown',
    model: typeof value.model === 'string' && value.model.length > 0 ? value.model : 'unknown',
    buckets,
  }
}
