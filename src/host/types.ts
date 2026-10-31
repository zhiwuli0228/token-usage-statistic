/**
 * Shared value types for the Host half.
 *
 * Everything here is plain JSON: the ledger, the folds and the HTTP read model
 * all use these shapes, so a record can be written to disk, replayed, and sent
 * to the browser without adapters.
 */

import type { BudgetState } from './accounts/types.js'

/** The four token buckets DSH providers report. */
export interface Buckets {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

/** A token bucket set plus the derived counters every view needs. */
export interface Totals extends Buckets {
  calls: number
  tokens: number
  cacheHitRate: number | null
}

/** The provider-reported `usage` object, untyped at the edge. */
export interface RawUsage {
  inputTokens?: unknown
  outputTokens?: unknown
  totalTokens?: unknown
  cacheReadTokens?: unknown
  cacheWriteTokens?: unknown
  reasoningTokens?: unknown
}

/** Where a usage sample came from. */
export type SampleKind = 'assistant' | 'compaction'

/**
 * One observed usage sample.
 *
 * `sampleKey` identifies the provider call: `turn:step` for assistant calls (a
 * usage chunk and the later committed message share it, so the later report
 * replaces the earlier one), `compaction:<id>` for a compaction summary.
 */
export interface UsageSample {
  version: 2
  sessionId: string
  seq: number
  time: number
  day: string
  sampleKey: string
  kind: SampleKind
  provider: string
  model: string
  buckets: Buckets
}

/** The pricing outcome attached to one sample. */
export type CostSample =
  | { counted: false }
  | { counted: true; complete: false }
  | { counted: true; complete: true; amount: number; currency: string; ruleId: string }

/** A priced sample that the store retains for replacement arithmetic. */
export interface StoredSample extends UsageSample {
  cost: CostSample
}

/** Additive money accumulator; maps keep mixed currencies representable. */
export interface CostAccumulator {
  pricedCalls: number
  unpricedCalls: number
  amounts: Map<string, number>
  ruleIds: Set<string>
}

/** The JSON-safe rendering of one accumulator. */
export interface CostRender {
  /** Sum when every counted sample is priced in one currency; otherwise null. */
  amount: number | null
  currency: string | null
  complete: boolean
  pricedCalls: number
  unpricedCalls: number
  ruleIds: string[]
}

/** One unit-price set, in currency units per 1M tokens. */
export interface UnitPrices {
  input: number | null
  cacheRead: number | null
  cacheWrite: number | null
  output: number | null
}

/** A peak/off-peak schedule in one IANA time zone. */
export interface PricingSchedule {
  timezone: string
  peakDays: readonly number[]
  peakWindows: ReadonlyArray<readonly [string, string]>
  otherwise: 'offPeak'
}

/** One historical price rule for an exact model id. */
export interface PricingRule {
  id: string
  /** Route family this rule belongs to; only `deepseek` exists today. */
  providerFamily: 'deepseek'
  model: string
  currency: string
  effectiveFrom?: string
  effectiveTo?: string
  pricing: { flat: UnitPrices } | { peak: UnitPrices; offPeak: UnitPrices }
  schedule: PricingSchedule | null
  source: { kind: 'official'; provider: string; url: string }
  updatedAt: string
}

/** The subset of a pricing rule the wire exposes. */
export interface PricingProvenance {
  ruleIds: string[]
  currency: string | null
  catalogUpdatedAt: string | null
}

/** One model row inside a provider group. */
export interface ModelUsageView extends Totals {
  key: string
  provider: string
  model: string
  cost: CostRender
}

/** One provider row. */
export interface ProviderUsageView extends Totals {
  provider: string
  cost: CostRender
  models: ModelUsageView[]
}

/** One calendar day row. */
export interface DayUsageView extends Totals {
  day: string
  cost: CostRender
}

/** One calendar day with a drill-down into its sessions and models. */
export interface DayDetailView extends Totals {
  day: string
  cost: CostRender
  sessions: SessionUsageView[]
  models: ModelUsageView[]
}

/** Payload for `GET /token-usage-statistic/api/daily`. */
export interface DailyPayload {
  schemaVersion: 2
  generatedAt: number
  range: { days: number | null; from: string | null; to: string | null }
  days: DayDetailView[]
}

/** One session row in the selected range. */
export interface SessionUsageView extends Totals {
  sessionId: string
  firstAt: number
  lastAt: number
  cost: CostRender
  models: string[]
}

/** A recent sample as the panel renders it. */
export interface RecentUsageView extends Totals {
  time: number
  sessionId: string
  provider: string
  model: string
  cost: CostRender
}

/** Whether a background historical scan is underway. */
export interface BackfillStatus {
  state: 'idle' | 'running' | 'done' | 'error'
  sessions: number
  events: number
  skipped: number
  /** Sessions whose leading events were inherited from a parent fork. */
  inherited: number
  startedAt: number | null
  finishedAt: number | null
  error: string | null
}

/** The complete `GET /token-usage-statistic/api/summary` payload. */
export interface UsageSnapshot {
  schemaVersion: 2
  generatedAt: number
  updatedAt: number
  range: { days: number | null; from: string | null; to: string | null }
  totals: Totals & { cost: CostRender }
  byProvider: ProviderUsageView[]
  byDay: DayUsageView[]
  sessions: SessionUsageView[]
  recent: RecentUsageView[]
  counts: {
    samples: number
    sessions: number
    days: number
    models: number
    unpriced: number
  }
  pricing: PricingProvenance
  budgets: BudgetState
  backfill: BackfillStatus
  config: { refreshMs: number }
}
