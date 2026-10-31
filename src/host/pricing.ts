/**
 * Historical, provider-aware token pricing.
 *
 * Cost is a derived estimate, never a stored truth: every sample is priced with
 * the rule that was effective at its own event time, so a later price change
 * does not rewrite history. Unknown routes/models and positive token buckets
 * without a unit price fail closed to `null` (an unpriced sample) instead of
 * guessing.
 *
 * The built-in catalog covers first-party DeepSeek USD prices. Routes whose
 * identity cannot be proven official (a custom gateway, a third-party
 * provider) are deliberately unpriced.
 */

import type { Buckets, CostSample, PricingRule, UnitPrices, UsageSample } from './types.js'

const TOKENS_PER_MILLION = 1_000_000
const CATALOG_UPDATED_AT = '2026-08-23T00:00:00.000Z'
const SOURCE = {
  kind: 'official' as const,
  provider: 'deepseek',
  url: 'https://api-docs.deepseek.com/quick_start/pricing/',
}

const TIME_BAND_V1_FROM = '2026-08-16T16:00:00.000Z'
const WEEKDAY_SCHEDULE_FROM = '2026-08-22T16:00:00.000Z'
const SHANGHAI_WINDOWS = [
  ['09:00', '12:00'],
  ['14:00', '18:00'],
] as const

function prices(input: number, cacheRead: number, output: number, cacheWrite: number | null = null): UnitPrices {
  return { input, cacheRead, cacheWrite, output }
}

function flatRule(input: {
  id: string
  model: string
  effectiveTo?: string
  unit: UnitPrices
}): PricingRule {
  return {
    id: input.id,
    providerFamily: 'deepseek',
    model: input.model,
    currency: 'USD',
    ...(input.effectiveTo === undefined ? {} : { effectiveTo: input.effectiveTo }),
    pricing: { flat: input.unit },
    schedule: null,
    source: { ...SOURCE },
    updatedAt: CATALOG_UPDATED_AT,
  }
}

function timeBandRule(input: {
  id: string
  model: string
  effectiveFrom: string
  effectiveTo?: string
  peakDays: readonly number[]
  offPeak: UnitPrices
  peak: UnitPrices
}): PricingRule {
  return {
    id: input.id,
    providerFamily: 'deepseek',
    model: input.model,
    currency: 'USD',
    effectiveFrom: input.effectiveFrom,
    ...(input.effectiveTo === undefined ? {} : { effectiveTo: input.effectiveTo }),
    pricing: { offPeak: input.offPeak, peak: input.peak },
    schedule: {
      timezone: 'Asia/Shanghai',
      peakDays: input.peakDays,
      peakWindows: SHANGHAI_WINDOWS,
      otherwise: 'offPeak',
    },
    source: { ...SOURCE },
    updatedAt: CATALOG_UPDATED_AT,
  }
}

/**
 * The built-in DeepSeek USD catalog (prices per 1M tokens).
 *
 * Peak windows are the published Shanghai business bands; weekends and nights
 * are off-peak. A rule applies to events inside its half-open effective window.
 */
export const DEEPSEEK_PRICING_RULES: readonly PricingRule[] = [
  flatRule({
    id: 'deepseek-v4-flash-usd-flat-before-2026-08-16',
    model: 'deepseek-v4-flash',
    effectiveTo: TIME_BAND_V1_FROM,
    unit: prices(0.14, 0.0028, 0.28),
  }),
  flatRule({
    id: 'deepseek-v4-pro-usd-flat-before-2026-08-16',
    model: 'deepseek-v4-pro',
    effectiveTo: TIME_BAND_V1_FROM,
    unit: prices(0.435, 0.003625, 0.87),
  }),
  timeBandRule({
    id: 'deepseek-v4-flash-usd-time-band-v1',
    model: 'deepseek-v4-flash',
    effectiveFrom: TIME_BAND_V1_FROM,
    effectiveTo: WEEKDAY_SCHEDULE_FROM,
    peakDays: [0, 1, 2, 3, 4, 5, 6],
    offPeak: prices(0.22, 0.007, 0.66),
    peak: prices(0.44, 0.014, 1.32),
  }),
  timeBandRule({
    id: 'deepseek-v4-pro-usd-time-band-v1',
    model: 'deepseek-v4-pro',
    effectiveFrom: TIME_BAND_V1_FROM,
    effectiveTo: WEEKDAY_SCHEDULE_FROM,
    peakDays: [0, 1, 2, 3, 4, 5, 6],
    offPeak: prices(0.66, 0.022, 1.98),
    peak: prices(1.32, 0.044, 3.96),
  }),
  timeBandRule({
    id: 'deepseek-v4-flash-usd-weekday-schedule',
    model: 'deepseek-v4-flash',
    effectiveFrom: WEEKDAY_SCHEDULE_FROM,
    peakDays: [1, 2, 3, 4, 5],
    offPeak: prices(0.22, 0.007, 0.66),
    peak: prices(0.44, 0.014, 1.32),
  }),
  timeBandRule({
    id: 'deepseek-v4-pro-usd-weekday-schedule',
    model: 'deepseek-v4-pro',
    effectiveFrom: WEEKDAY_SCHEDULE_FROM,
    peakDays: [1, 2, 3, 4, 5],
    offPeak: prices(0.66, 0.022, 1.98),
    peak: prices(1.32, 0.044, 3.96),
  }),
]

/**
 * Model ids that DSH routes report for the same priced model.
 *
 * The Desktop account route reports `deepseek-flash`/`deepseek-pro` while the
 * pi-ai profiles use the `v4` ids; both name the same published model. Users
 * can override or extend this map through plugin config.
 */
export const DEFAULT_MODEL_ALIASES: Readonly<Record<string, string>> = {
  'deepseek-flash': 'deepseek-v4-flash',
  'deepseek-pro': 'deepseek-v4-pro',
}

/** Provider routes whose identity is provably the first-party DeepSeek API. */
export const DEFAULT_PRICED_PROVIDERS: readonly string[] = [
  'deepseek',
  'deepseek-official',
  'deepseek-account',
]

function timestampOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const normalized = value.trim()
    if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized)) return null
    const parsed = Date.parse(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function boundaryOf(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const timestamp = timestampOf(value)
  if (timestamp === null) throw new Error(`invalid pricing boundary: ${value}`)
  return timestamp
}

function minuteOf(clock: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(clock)
  if (match === null) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null
  return hour * 60 + minute
}

function isEffective(rule: PricingRule, at: number): boolean {
  if (at < boundaryOf(rule.effectiveFrom, -Infinity)) return false
  if (at >= boundaryOf(rule.effectiveTo, Infinity)) return false
  return true
}

/**
 * Validate a caller-supplied catalog enough to keep a bad config from silently
 * mispricing everything. Invalid rules are rejected; the caller decides whether
 * to fall back.
 */
export function validateRules(rules: readonly PricingRule[]): void {
  if (!Array.isArray(rules)) throw new Error('pricing rules must be an array')
  const ids = new Set<string>()
  for (const [index, rule] of rules.entries()) {
    const label = `pricing.rules[${index}]`
    if (rule === null || typeof rule !== 'object') throw new Error(`${label} must be an object`)
    if (typeof rule.id !== 'string' || rule.id === '' || ids.has(rule.id)) throw new Error(`${label}.id must be unique`)
    ids.add(rule.id)
    if (typeof rule.model !== 'string' || rule.model === '') throw new Error(`${label}.model is required`)
    if (typeof rule.currency !== 'string' || !/^[A-Z]{3}$/.test(rule.currency)) throw new Error(`${label}.currency is invalid`)
    if (rule.schedule === null) {
      if (!('flat' in rule.pricing)) throw new Error(`${label}.pricing must be flat without a schedule`)
    } else if (!('peak' in rule.pricing) || !('offPeak' in rule.pricing)) {
      throw new Error(`${label}.pricing must carry peak and offPeak with a schedule`)
    }
    boundaryOf(rule.effectiveFrom, -Infinity)
    boundaryOf(rule.effectiveTo, Infinity)
  }
}

function zonedClock(timestamp: number, timezone: string): { weekday: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = formatter.formatToParts(new Date(timestamp))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    weekday: weekdays[get('weekday')] ?? -1,
    minute: Number(get('hour')) * 60 + Number(get('minute')),
  }
}

function unitPricesAt(rule: PricingRule, at: number): UnitPrices | null {
  if (rule.schedule === null) {
    return 'flat' in rule.pricing ? rule.pricing.flat : null
  }
  const clock = zonedClock(at, rule.schedule.timezone)
  const inPeakDay = rule.schedule.peakDays.includes(clock.weekday)
  const inPeakWindow = rule.schedule.peakWindows.some(([start, end]) => {
    const from = minuteOf(start)
    const to = minuteOf(end)
    return from !== null && to !== null && clock.minute >= from && clock.minute < to
  })
  if ('peak' in rule.pricing && 'offPeak' in rule.pricing) {
    return inPeakDay && inPeakWindow ? rule.pricing.peak : rule.pricing.offPeak
  }
  return null
}

/** The pricing outcome for one sample, without the counted wrapper. */
export interface CostEstimate {
  amount: number
  currency: string
  ruleId: string
  tariff: string
  unit: UnitPrices
}

export interface PricerOptions {
  rules?: readonly PricingRule[]
  aliases?: Readonly<Record<string, string>>
  providers?: readonly string[]
}

export interface Pricer {
  estimate(sample: UsageSample): CostSample
  /** Catalog metadata for the wire. */
  readonly rules: readonly PricingRule[]
  readonly catalogUpdatedAt: string
}

function priceBuckets(unit: UnitPrices, buckets: Buckets): number | null {
  const components: Array<[number, number | null]> = [
    [buckets.input, unit.input],
    [buckets.cacheRead, unit.cacheRead],
    [buckets.cacheWrite, unit.cacheWrite],
    [buckets.output, unit.output],
  ]
  let total = 0
  for (const [tokens, price] of components) {
    if (tokens === 0) continue
    if (price === null) return null
    total += (tokens / TOKENS_PER_MILLION) * price
  }
  return total
}

/**
 * Build the pricer used by the store.
 *
 * An invalid user catalog is ignored with a warning rather than failing the
 * plugin: usage statistics must keep working even when a hand-edited price
 * table is wrong.
 */
export function createPricer(options: PricerOptions = {}, warn: (message: string) => void = () => {}): Pricer {
  const userRules = options.rules ?? []
  if (userRules.length > 0) {
    try {
      validateRules(userRules)
    } catch (error) {
      warn(`ignoring invalid pricing.rules: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  const validUserRules = userRules.length > 0 ? userRules : []
  // User rules are appended so an explicit override wins only when it has a
  // later id; same-id rules are filtered out first.
  const userIds = new Set(validUserRules.map((rule) => rule.id))
  const rules: PricingRule[] = [...DEEPSEEK_PRICING_RULES.filter((rule) => !userIds.has(rule.id)), ...validUserRules]
  const aliases = { ...DEFAULT_MODEL_ALIASES, ...(options.aliases ?? {}) }
  const providers = new Set(options.providers ?? DEFAULT_PRICED_PROVIDERS)

  function estimate(sample: UsageSample): CostSample {
    const buckets = sample.buckets
    if (buckets.input + buckets.output + buckets.cacheRead + buckets.cacheWrite <= 0) return { counted: false }
    if (!providers.has(sample.provider)) return { counted: true, complete: false }

    const model = aliases[sample.model] ?? sample.model
    const at = sample.time
    const candidates = rules.filter((rule) => rule.model === model && isEffective(rule, at))
    if (candidates.length === 0) return { counted: true, complete: false }
    if (candidates.length > 1) {
      // Overlapping effective windows are a catalog bug; fail closed instead of
      // picking one arbitrarily.
      return { counted: true, complete: false }
    }
    const rule = candidates[0]!
    const unit = unitPricesAt(rule, at)
    if (unit === null) return { counted: true, complete: false }
    const amount = priceBuckets(unit, buckets)
    if (amount === null) return { counted: true, complete: false }
    return { counted: true, complete: true, amount, currency: rule.currency, ruleId: rule.id }
  }

  return {
    estimate,
    rules,
    catalogUpdatedAt: CATALOG_UPDATED_AT,
  }
}
