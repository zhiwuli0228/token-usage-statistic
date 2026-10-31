/**
 * The in-memory fold over usage samples.
 *
 * Samples are the durable unit (see `usage.ts`); this store keeps them keyed by
 * `sessionId#sampleKey` so a later report for the same provider call replaces
 * the earlier one, and folds every accepted sample into three derived views:
 * per-day (with per-model and per-session splits), all-time sessions, and a
 * bounded recent list.
 *
 * Replacement is arithmetic in both directions: adding a sample and subtracting
 * the sample it replaces are the same operation with a sign, which keeps chunk
 * → message upgrades exact without replaying a session.
 */

import { applyCostSample, cloneCost, createCostAccumulator, mergeCost, renderCost, renderSampleCost } from './cost.js'
import type { BudgetState } from './accounts/types.js'
import type { Pricer } from './pricing.js'
import type {
  BackfillStatus,
  Buckets,
  CostAccumulator,
  ModelUsageView,
  ProviderUsageView,
  RecentUsageView,
  SessionUsageView,
  StoredSample,
  UsageSample,
  UsageSnapshot,
} from './types.js'
import { addBuckets, cacheHitRate, dayKey, emptyBuckets, sanitizeSample, totalTokens } from './usage.js'

/** Fold of model-level counters. */
interface ModelFold {
  buckets: Buckets
  cost: CostAccumulator
  calls: number
}

/** Fold of session-level counters inside one day. */
interface SessionDayFold {
  buckets: Buckets
  cost: CostAccumulator
  calls: number
  lastAt: number
}

/** Fold of one calendar day. */
interface DayFold {
  day: string
  buckets: Buckets
  cost: CostAccumulator
  calls: number
  models: Map<string, ModelFold>
  sessions: Map<string, SessionDayFold>
}

/** All-time fold of one session. */
interface SessionRecord {
  buckets: Buckets
  cost: CostAccumulator
  calls: number
  firstAt: number
  lastAt: number
  /** model key → number of live samples attributed to it */
  models: Map<string, number>
}

/** The model key: provider and model joined, so two routes stay distinct. */
export function modelKeyOf(provider: string, model: string): string {
  return `${provider}/${model}`
}

/** Split a model key back into provider and model at the first slash. */
export function splitModelKey(key: string): { provider: string; model: string } {
  const slash = key.indexOf('/')
  if (slash <= 0 || slash === key.length - 1) return { provider: 'unknown', model: key }
  return { provider: key.slice(0, slash), model: key.slice(slash + 1) }
}

/** Shift one bucket set by a sign, in place. */
function shiftBuckets(target: Buckets, source: Buckets, sign: 1 | -1): void {
  target.input += sign * source.input
  target.output += sign * source.output
  target.cacheRead += sign * source.cacheRead
  target.cacheWrite += sign * source.cacheWrite
}

/**
 * Resolve the inclusive day range of a snapshot.
 *
 * `days = 1` means today; `null` means all time. `from` is a local calendar key,
 * which is also how day folds are keyed, so range filtering is a string compare.
 */
export function resolveRange(days: number | null, now: number): { days: number; from: string; to: string } | null {
  if (days === null) return null
  const requested = Math.floor(Number(days))
  if (!Number.isFinite(requested) || requested <= 0) return null
  const window = Math.min(requested, 3650)
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (window - 1))
  return { days: window, from: dayKey(start.getTime()), to: dayKey(now) }
}

const DEFAULT_BUDGETS: BudgetState = {
  currency: 'USD',
  daily: { limit: null, currency: 'USD', spend: 0, percent: null, costComplete: true, level: null },
  monthly: { limit: null, currency: 'USD', spend: 0, percent: null, costComplete: true, level: null },
}

function totalsOf(buckets: Buckets, calls: number): { calls: number; input: number; output: number; cacheRead: number; cacheWrite: number; tokens: number; cacheHitRate: number | null } {
  return {
    calls,
    input: buckets.input,
    output: buckets.output,
    cacheRead: buckets.cacheRead,
    cacheWrite: buckets.cacheWrite,
    tokens: totalTokens(buckets),
    cacheHitRate: cacheHitRate(buckets),
  }
}

export interface SnapshotOptions {
  days?: number | null
  sessionLimit?: number
  recentLimit?: number
  now?: number
  backfill?: BackfillStatus
  budgets?: BudgetState
  refreshMs?: number
}

/** The plugin's usage fold. */
export class UsageStore {
  private readonly pricer: Pricer
  private readonly recentLimit: number
  private readonly samples = new Map<string, StoredSample>()
  private readonly days = new Map<string, DayFold>()
  private readonly sessions = new Map<string, SessionRecord>()
  private readonly maxSeq = new Map<string, number>()
  private recent: StoredSample[] = []
  private updatedAt = 0
  private skipped = 0
  private replaced = 0

  constructor(options: { pricer: Pricer; recentLimit?: number }) {
    this.pricer = options.pricer
    this.recentLimit = Number.isFinite(options.recentLimit) && (options.recentLimit ?? 0) >= 0
      ? Math.floor(options.recentLimit ?? 200)
      : 200
  }

  /** Fold one untrusted ledger line or collector sample. */
  apply(raw: unknown): boolean {
    const sample = sanitizeSample(raw)
    if (sample === null) {
      this.skipped += 1
      return false
    }
    const key = `${sample.sessionId}#${sample.sampleKey}`
    const previous = this.samples.get(key)
    // An older report arriving after a newer one (a historical scan racing the
    // live feed) must not downgrade a committed message back to a usage chunk.
    if (previous !== undefined && sample.seq < previous.seq) return false
    if (previous !== undefined && this.isSameReport(previous, sample)) return false

    const cost = this.pricer.estimate(sample)
    if (previous !== undefined) {
      this.mutate(previous, -1)
      this.replaced += 1
      this.removeRecent(key)
    }
    const stored: StoredSample = { ...sample, cost }
    this.samples.set(key, stored)
    this.mutate(stored, 1)
    this.pushRecent(stored)

    const previousSeq = this.maxSeq.get(sample.sessionId) ?? -1
    if (sample.seq > previousSeq) this.maxSeq.set(sample.sessionId, sample.seq)
    if (sample.time > this.updatedAt) this.updatedAt = sample.time
    return true
  }

  /** Fold many lines; returns how many were accepted. */
  applyAll(raws: Iterable<unknown>): number {
    let accepted = 0
    for (const raw of raws) if (this.apply(raw)) accepted += 1
    return accepted
  }

  /** Highest accepted seq per session, for incremental historical scans. */
  lastSeqBySession(): Map<string, number> {
    return new Map(this.maxSeq)
  }

  /** Highest accepted seq for one session (-1 when nothing was seen). */
  lastSeq(sessionId: string): number {
    return this.maxSeq.get(sessionId) ?? -1
  }

  /** How many lines were rejected and how many were replaced. */
  diagnostics(): { skipped: number; replaced: number } {
    return { skipped: this.skipped, replaced: this.replaced }
  }

  private isSameReport(left: StoredSample, right: UsageSample): boolean {
    return (
      left.seq === right.seq &&
      left.time === right.time &&
      left.buckets.input === right.buckets.input &&
      left.buckets.output === right.buckets.output &&
      left.buckets.cacheRead === right.buckets.cacheRead &&
      left.buckets.cacheWrite === right.buckets.cacheWrite
    )
  }

  /** Add (`1`) or subtract (`-1`) one sample from every fold it touches. */
  private mutate(sample: StoredSample, sign: 1 | -1): void {
    const day = this.ensureDay(sample.day)
    shiftBuckets(day.buckets, sample.buckets, sign)
    day.calls += sign
    applyCostSample(day.cost, sample.cost, sign)

    const model = this.ensureModel(day, sample)
    shiftBuckets(model.buckets, sample.buckets, sign)
    model.calls += sign
    applyCostSample(model.cost, sample.cost, sign)

    let sessionDay = day.sessions.get(sample.sessionId)
    if (sessionDay === undefined) {
      sessionDay = { buckets: emptyBuckets(), cost: createCostAccumulator(), calls: 0, lastAt: sample.time }
      day.sessions.set(sample.sessionId, sessionDay)
    }
    shiftBuckets(sessionDay.buckets, sample.buckets, sign)
    sessionDay.calls += sign
    sessionDay.lastAt = Math.max(sessionDay.lastAt, sample.time)
    applyCostSample(sessionDay.cost, sample.cost, sign)

    let session = this.sessions.get(sample.sessionId)
    if (session === undefined) {
      session = {
        buckets: emptyBuckets(),
        cost: createCostAccumulator(),
        calls: 0,
        firstAt: sample.time,
        lastAt: sample.time,
        models: new Map(),
      }
      this.sessions.set(sample.sessionId, session)
    }
    shiftBuckets(session.buckets, sample.buckets, sign)
    session.calls += sign
    applyCostSample(session.cost, sample.cost, sign)
    session.firstAt = Math.min(session.firstAt, sample.time)
    session.lastAt = Math.max(session.lastAt, sample.time)
    const key = modelKeyOf(sample.provider, sample.model)
    const count = (session.models.get(key) ?? 0) + sign
    if (count <= 0) session.models.delete(key)
    else session.models.set(key, count)

    this.prune(day, sample, sign)
  }

  private prune(day: DayFold, sample: StoredSample, sign: 1 | -1): void {
    if (sign > 0) return
    const model = day.models.get(modelKeyOf(sample.provider, sample.model))
    if (model !== undefined && model.calls <= 0) day.models.delete(modelKeyOf(sample.provider, sample.model))
    const sessionDay = day.sessions.get(sample.sessionId)
    if (sessionDay !== undefined && sessionDay.calls <= 0) day.sessions.delete(sample.sessionId)
    const session = this.sessions.get(sample.sessionId)
    if (session !== undefined && session.calls <= 0) this.sessions.delete(sample.sessionId)
    if (day.calls <= 0 && day.models.size === 0) this.days.delete(day.day)
  }

  private ensureDay(day: string): DayFold {
    let entry = this.days.get(day)
    if (entry === undefined) {
      entry = {
        day,
        buckets: emptyBuckets(),
        cost: createCostAccumulator(),
        calls: 0,
        models: new Map(),
        sessions: new Map(),
      }
      this.days.set(day, entry)
    }
    return entry
  }

  private ensureModel(day: DayFold, sample: StoredSample): ModelFold {
    const key = modelKeyOf(sample.provider, sample.model)
    let entry = day.models.get(key)
    if (entry === undefined) {
      entry = { buckets: emptyBuckets(), cost: createCostAccumulator(), calls: 0 }
      day.models.set(key, entry)
    }
    return entry
  }

  private pushRecent(sample: StoredSample): void {
    if (this.recentLimit <= 0) return
    this.recent.push(sample)
    const overflow = this.recent.length - this.recentLimit
    if (overflow > 0) this.recent.splice(0, overflow)
  }

  private removeRecent(key: string): void {
    const index = this.recent.findIndex((sample) => `${sample.sessionId}#${sample.sampleKey}` === key)
    if (index >= 0) this.recent.splice(index, 1)
  }

  /** Merge the cost accumulators of every day inside the inclusive range. */
  costBetween(from: string, to: string): CostAccumulator {
    const accumulator = createCostAccumulator()
    for (const [day, entry] of this.days) {
      if (day < from || day > to) continue
      mergeCost(accumulator, entry.cost)
    }
    return accumulator
  }

  /** Flatten every day/model fold into export rows. */
  dailyRows(): Array<{
    day: string
    provider: string
    model: string
    calls: number
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    tokens: number
    cacheHitRate: number | null
    cost: ReturnType<typeof renderCost>
  }> {
    const rows: ReturnType<UsageStore['dailyRows']> = []
    for (const [day, entry] of this.days) {
      for (const [key, model] of entry.models) {
        const { provider, model: modelId } = splitModelKey(key)
        rows.push({
          day,
          provider,
          model: modelId,
          ...totalsOf(model.buckets, model.calls),
          cost: renderCost(model.cost),
        })
      }
    }
    rows.sort(
      (left, right) =>
        (left.day < right.day ? 1 : left.day > right.day ? -1 : 0) ||
        left.provider.localeCompare(right.provider) ||
        left.model.localeCompare(right.model),
    )
    return rows
  }

  /** Flatten every all-time session fold into export rows. */
  sessionRows(): Array<{
    sessionId: string
    providers: string[]
    models: string[]
    calls: number
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    tokens: number
    cacheHitRate: number | null
    cost: ReturnType<typeof renderCost>
    firstAt: number
    lastAt: number
  }> {
    const rows: ReturnType<UsageStore['sessionRows']> = []
    for (const [sessionId, session] of this.sessions) {
      const models = [...session.models.keys()]
      const providers = [...new Set(models.map((key) => splitModelKey(key).provider))].sort()
      rows.push({
        sessionId,
        providers,
        models: models.sort(),
        ...totalsOf(session.buckets, session.calls),
        cost: renderCost(session.cost),
        firstAt: session.firstAt,
        lastAt: session.lastAt,
      })
    }
    rows.sort((left, right) => right.tokens - left.tokens || right.calls - left.calls)
    return rows
  }

  /** The pricing catalog's own version string. */
  pricingCatalogUpdatedAt(): string {
    return this.pricer.catalogUpdatedAt
  }

  /** Build the JSON payload the panel consumes. */
  snapshot(options: SnapshotOptions = {}): UsageSnapshot {
    const now = options.now ?? Date.now()
    // `null` is a real request ("all time"), not a missing value.
    const requestedDays = options.days === undefined ? 30 : options.days
    const range = resolveRange(requestedDays, now)
    const sessionLimit = Math.max(0, Math.floor(options.sessionLimit ?? 12))
    const recentLimit = Math.max(0, Math.floor(options.recentLimit ?? 20))

    const buckets = emptyBuckets()
    let calls = 0
    const totalCost = createCostAccumulator()
    const models = new Map<string, ModelFold>()
    const sessions = new Map<string, { buckets: Buckets; cost: CostAccumulator; calls: number; lastAt: number }>()
    const byDay: UsageSnapshot['byDay'] = []

    for (const [day, entry] of this.days) {
      if (range !== null && day < range.from) continue
      shiftBuckets(buckets, entry.buckets, 1)
      calls += entry.calls
      mergeCost(totalCost, entry.cost)
      byDay.push({
        day: day,
        ...totalsOf(entry.buckets, entry.calls),
        cost: renderCost(entry.cost),
      })
      for (const [key, model] of entry.models) {
        let target = models.get(key)
        if (target === undefined) {
          target = { buckets: emptyBuckets(), cost: createCostAccumulator(), calls: 0 }
          models.set(key, target)
        }
        shiftBuckets(target.buckets, model.buckets, 1)
        target.calls += model.calls
        mergeCost(target.cost, model.cost)
      }
      for (const [sessionId, session] of entry.sessions) {
        let target = sessions.get(sessionId)
        if (target === undefined) {
          target = { buckets: emptyBuckets(), cost: createCostAccumulator(), calls: 0, lastAt: session.lastAt }
          sessions.set(sessionId, target)
        }
        shiftBuckets(target.buckets, session.buckets, 1)
        target.calls += session.calls
        target.lastAt = Math.max(target.lastAt, session.lastAt)
        mergeCost(target.cost, session.cost)
      }
    }

    byDay.sort((left, right) => (left.day < right.day ? 1 : left.day > right.day ? -1 : 0))

    const modelViews: ModelUsageView[] = []
    for (const [key, model] of models) {
      const { provider, model: modelId } = splitModelKey(key)
      modelViews.push({
        key,
        provider,
        model: modelId,
        ...totalsOf(model.buckets, model.calls),
        cost: renderCost(model.cost),
      })
    }
    modelViews.sort((left, right) => right.tokens - left.tokens || right.calls - left.calls || left.key.localeCompare(right.key))

    const grouped = new Map<string, { buckets: Buckets; cost: CostAccumulator; calls: number; models: ModelUsageView[] }>()
    for (const [key, model] of models) {
      const { provider, model: modelId } = splitModelKey(key)
      let entry = grouped.get(provider)
      if (entry === undefined) {
        entry = { buckets: emptyBuckets(), cost: createCostAccumulator(), calls: 0, models: [] }
        grouped.set(provider, entry)
      }
      shiftBuckets(entry.buckets, model.buckets, 1)
      entry.calls += model.calls
      mergeCost(entry.cost, model.cost)
      entry.models.push({
        key,
        provider,
        model: modelId,
        ...totalsOf(model.buckets, model.calls),
        cost: renderCost(model.cost),
      })
    }
    const byProvider: ProviderUsageView[] = [...grouped.entries()]
      .map(([provider, entry]) => ({
        provider,
        ...totalsOf(entry.buckets, entry.calls),
        cost: renderCost(entry.cost),
        models: entry.models.sort((left, right) => right.tokens - left.tokens || left.model.localeCompare(right.model)),
      }))
      .sort((left, right) => right.tokens - left.tokens || left.provider.localeCompare(right.provider))

    const sessionViews: SessionUsageView[] = []
    for (const [sessionId, session] of sessions) {
      const record = this.sessions.get(sessionId)
      sessionViews.push({
        sessionId,
        calls: session.calls,
        input: session.buckets.input,
        output: session.buckets.output,
        cacheRead: session.buckets.cacheRead,
        cacheWrite: session.buckets.cacheWrite,
        tokens: totalTokens(session.buckets),
        cacheHitRate: cacheHitRate(session.buckets),
        firstAt: record?.firstAt ?? session.lastAt,
        lastAt: record?.lastAt ?? session.lastAt,
        cost: renderCost(session.cost),
        models: record === undefined ? [] : [...record.models.keys()].sort(),
      })
    }
    sessionViews.sort((left, right) => right.tokens - left.tokens || right.calls - left.calls)
    const limitedSessions = sessionViews.slice(0, sessionLimit)

    const recent: RecentUsageView[] = this.recent
      .filter((sample) => range === null || sample.day >= range.from)
      .sort((left, right) => right.time - left.time)
      .slice(0, recentLimit)
      .map((sample) => ({
        time: sample.time,
        sessionId: sample.sessionId,
        provider: sample.provider,
        model: sample.model,
        calls: 1,
        input: sample.buckets.input,
        output: sample.buckets.output,
        cacheRead: sample.buckets.cacheRead,
        cacheWrite: sample.buckets.cacheWrite,
        tokens: totalTokens(sample.buckets),
        cacheHitRate: cacheHitRate(sample.buckets),
        cost: renderSampleCost(sample.cost),
      }))

    const totalCostRender = renderCost(totalCost)
    return {
      schemaVersion: 2,
      generatedAt: now,
      updatedAt: this.updatedAt,
      range: range === null ? { days: null, from: null, to: null } : range,
      totals: { ...totalsOf(buckets, calls), cost: totalCostRender },
      byProvider,
      byDay,
      sessions: limitedSessions,
      recent,
      counts: {
        samples: this.samples.size,
        sessions: this.sessions.size,
        days: this.days.size,
        models: modelViews.length,
        unpriced: totalCostRender.unpricedCalls,
      },
      pricing: {
        ruleIds: totalCostRender.ruleIds,
        currency: totalCostRender.currency,
        catalogUpdatedAt: this.pricer.catalogUpdatedAt,
      },
      budgets: options.budgets ?? DEFAULT_BUDGETS,
      backfill: options.backfill ?? {
        state: 'idle',
        sessions: 0,
        events: 0,
        skipped: 0,
        inherited: 0,
        startedAt: null,
        finishedAt: null,
        error: null,
      },
      config: { refreshMs: options.refreshMs ?? 15000 },
    }
  }
}
