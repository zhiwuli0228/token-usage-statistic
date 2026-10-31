/**
 * In-memory folds over token-usage records.
 *
 * The store keeps three differently-shaped views of the same data, because the
 * panel asks three different questions and rescanning the ledger for each would
 * be wasteful:
 *
 *  - `days`  — per calendar day: totals, per-model totals and per-session totals.
 *  - `total` — all-time totals, kept as a fast path for the "all time" range.
 *  - `recent` — the newest records, for the "latest calls" strip.
 *
 * Every view is derived state: `apply()` is the only writer, and replaying the
 * ledger from the beginning reproduces exactly the same store. That is what
 * makes the JSONL file the source of truth and this class a cache.
 */

import {
  addTotals,
  cloneTotals,
  emptyTotals,
  localDayKey,
  recordKey,
  sanitizeRecord,
  totalsOfUsage,
} from './usage.js'

/**
 * The key one provider/model route folds under.
 *
 * The provider is part of the key because the same model id can be served by
 * several routes (an API-key route and an account route, for instance), and
 * merging them would hide which route produced the usage.
 *
 * @param {string} provider - provider route id.
 * @param {string} model - model id.
 * @returns {string} fold key.
 */
export function modelKey(provider, model) {
  return `${provider}\u0000${model}`
}

/**
 * Split a model fold key back into its parts.
 *
 * @param {string} key - key produced by {@link modelKey}.
 * @returns {{ provider: string, model: string }} the two parts.
 */
export function splitModelKey(key) {
  const index = key.indexOf('\u0000')
  return index === -1
    ? { provider: 'unknown', model: key }
    : { provider: key.slice(0, index), model: key.slice(index + 1) }
}

/**
 * Fold one record into a model table.
 *
 * @param {Map<string, { provider: string, model: string, totals: ReturnType<typeof emptyTotals> }>} table - destination table.
 * @param {{ provider: string, model: string }} record - record supplying the identity.
 * @param {ReturnType<typeof emptyTotals>} contribution - counters of one call.
 * @returns {void}
 */
function foldModel(table, record, contribution) {
  const key = modelKey(record.provider, record.model)
  let entry = table.get(key)
  if (entry === undefined) {
    entry = { provider: record.provider, model: record.model, totals: emptyTotals() }
    table.set(key, entry)
  }
  addTotals(entry.totals, contribution)
}

/**
 * Fold one record into a session table.
 *
 * @param {Map<string, { sessionId: string, totals: ReturnType<typeof emptyTotals>, lastUsedAt: number }>} table - destination table.
 * @param {{ sessionId: string, time: number }} record - record supplying the identity.
 * @param {ReturnType<typeof emptyTotals>} contribution - counters of one call.
 * @returns {void}
 */
function foldSession(table, record, contribution) {
  let entry = table.get(record.sessionId)
  if (entry === undefined) {
    entry = { sessionId: record.sessionId, totals: emptyTotals(), lastUsedAt: record.time }
    table.set(record.sessionId, entry)
  }
  addTotals(entry.totals, contribution)
  if (record.time > entry.lastUsedAt) entry.lastUsedAt = record.time
}

/**
 * Resolve the inclusive day range a snapshot covers.
 *
 * @param {number | null | undefined} days - trailing window in calendar days, or null/0 for everything.
 * @param {number} now - current epoch milliseconds.
 * @returns {null | { days: number, from: string, to: string }} the range, or null for all time.
 */
export function resolveRange(days, now) {
  if (days === null || days === undefined || days === 0) return null
  const requested = Math.floor(Number(days))
  if (!Number.isFinite(requested) || requested <= 0) return null
  const window = Math.min(requested, 3650)
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (window - 1))
  return { days: window, from: localDayKey(start.getTime()), to: localDayKey(now) }
}

/**
 * A fold of every token-usage record this Host has observed.
 */
export class UsageStore {
  /**
   * @param {{ recentLimit?: number }} [options] - how many newest records to retain for the strip.
   */
  constructor({ recentLimit = 200 } = {}) {
    /** @type {Map<string, { totals: ReturnType<typeof emptyTotals>, models: Map<string, { provider: string, model: string, totals: ReturnType<typeof emptyTotals> }>, sessions: Map<string, { sessionId: string, totals: ReturnType<typeof emptyTotals>, lastUsedAt: number }> }>} */
    this.days = new Map()
    this.total = emptyTotals()
    /** @type {Map<string, { provider: string, model: string, totals: ReturnType<typeof emptyTotals> }>} */
    this.models = new Map()
    /** @type {Map<string, { sessionId: string, totals: ReturnType<typeof emptyTotals>, lastUsedAt: number }>} */
    this.sessions = new Map()
    /** @type {Array<Record<string, unknown>>} */
    this.recent = []
    this.recentLimit = Number.isFinite(recentLimit) && recentLimit >= 0 ? Math.floor(recentLimit) : 200
    this.records = 0
    this.skipped = 0
    this.duplicates = 0
    this.updatedAt = 0
    /** @type {Set<string>} */
    this.seen = new Set()
  }

  /**
   * Fold one untrusted record in.
   *
   * @param {unknown} raw - ledger line or collector output.
   * @returns {boolean} whether the record was accepted (false for invalid or duplicate input).
   */
  apply(raw) {
    const record = sanitizeRecord(raw)
    if (record === null) {
      this.skipped += 1
      return false
    }
    const key = recordKey(record)
    if (this.seen.has(key)) {
      this.duplicates += 1
      return false
    }
    this.seen.add(key)

    const contribution = totalsOfUsage(record.usage)
    addTotals(this.total, contribution)
    foldModel(this.models, record, contribution)
    foldSession(this.sessions, record, contribution)

    let bucket = this.days.get(record.day)
    if (bucket === undefined) {
      bucket = { totals: emptyTotals(), models: new Map(), sessions: new Map() }
      this.days.set(record.day, bucket)
    }
    addTotals(bucket.totals, contribution)
    foldModel(bucket.models, record, contribution)
    foldSession(bucket.sessions, record, contribution)

    if (this.recentLimit > 0) {
      this.recent.push(record)
      const overflow = this.recent.length - this.recentLimit
      if (overflow > 0) this.recent.splice(0, overflow)
    }

    this.records += 1
    if (record.time > this.updatedAt) this.updatedAt = record.time
    return true
  }

  /**
   * Build the JSON payload the panel consumes.
   *
   * @param {{ days?: number | null, sessionLimit?: number, recentLimit?: number, now?: number }} [options] - range and table sizes.
   * @returns {Record<string, unknown>} a detached, JSON-safe snapshot.
   */
  snapshot({ days = 30, sessionLimit = 12, recentLimit = 20, now = Date.now() } = {}) {
    const range = resolveRange(days, now)
    const totals = emptyTotals()
    /** @type {Map<string, { provider: string, model: string, totals: ReturnType<typeof emptyTotals> }>} */
    const models = new Map()
    /** @type {Map<string, { sessionId: string, totals: ReturnType<typeof emptyTotals>, lastUsedAt: number }>} */
    const sessions = new Map()
    /** @type {Array<{ day: string, totals: ReturnType<typeof emptyTotals> }>} */
    const byDay = []

    for (const [day, bucket] of this.days) {
      if (range !== null && day < range.from) continue
      addTotals(totals, bucket.totals)
      byDay.push({ day, totals: cloneTotals(bucket.totals) })
      for (const [key, entry] of bucket.models) {
        let target = models.get(key)
        if (target === undefined) {
          target = { provider: entry.provider, model: entry.model, totals: emptyTotals() }
          models.set(key, target)
        }
        addTotals(target.totals, entry.totals)
      }
      for (const [id, entry] of bucket.sessions) {
        let target = sessions.get(id)
        if (target === undefined) {
          target = { sessionId: id, totals: emptyTotals(), lastUsedAt: entry.lastUsedAt }
          sessions.set(id, target)
        }
        addTotals(target.totals, entry.totals)
        if (entry.lastUsedAt > target.lastUsedAt) target.lastUsedAt = entry.lastUsedAt
      }
    }

    byDay.sort((left, right) => (left.day < right.day ? 1 : left.day > right.day ? -1 : 0))

    const byModel = [...models.values()]
      .map((entry) => ({ provider: entry.provider, model: entry.model, ...cloneTotals(entry.totals) }))
      .sort((left, right) => right.totalTokens - left.totalTokens || right.calls - left.calls || left.model.localeCompare(right.model))

    const sessionList = [...sessions.values()]
      .map((entry) => ({ sessionId: entry.sessionId, lastUsedAt: entry.lastUsedAt, ...cloneTotals(entry.totals) }))
      .sort((left, right) => right.totalTokens - left.totalTokens || right.calls - left.calls)
      .slice(0, Math.max(0, sessionLimit))

    const newest = [...this.recent]
      .filter((record) => range === null || record.day >= range.from)
      .sort((left, right) => right.time - left.time)
      .slice(0, Math.max(0, recentLimit))
      .map((record) => ({
        time: record.time,
        day: record.day,
        sessionId: record.sessionId,
        ...(record.seq === undefined ? {} : { seq: record.seq }),
        provider: record.provider,
        model: record.model,
        ...cloneTotals(totalsOfUsage(record.usage)),
      }))

    return {
      version: 1,
      generatedAt: now,
      updatedAt: this.updatedAt,
      range: range === null ? { days: null, from: null, to: null } : range,
      totals,
      byModel,
      byDay,
      sessions: sessionList,
      recent: newest,
      counts: {
        records: this.records,
        skipped: this.skipped,
        duplicates: this.duplicates,
        days: this.days.size,
        models: this.models.size,
        sessions: this.sessions.size,
        recent: this.recent.length,
      },
    }
  }
}
