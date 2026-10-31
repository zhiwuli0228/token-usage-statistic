/**
 * Additive money accumulators.
 *
 * A cost sample is either priced (one amount in one currency), explicitly
 * unpriced (positive tokens with no trustworthy price), or not counted at all
 * (zero-token warmup). Aggregates keep priced and unpriced calls apart so the
 * panel can show a trustworthy sum and name what is missing instead of hiding
 * either behind a single number.
 */

import type { CostAccumulator, CostRender, CostSample } from './types.js'

/** A fresh zeroed accumulator. */
export function createCostAccumulator(): CostAccumulator {
  return { pricedCalls: 0, unpricedCalls: 0, amounts: new Map(), ruleIds: new Set() }
}

/** Detached copy. */
export function cloneCost(accumulator: CostAccumulator): CostAccumulator {
  return {
    pricedCalls: accumulator.pricedCalls,
    unpricedCalls: accumulator.unpricedCalls,
    amounts: new Map(accumulator.amounts),
    ruleIds: new Set(accumulator.ruleIds),
  }
}

/**
 * Add (`direction = 1`) or subtract (`direction = -1`) one sample's cost.
 *
 * Counts clamp at zero: a replacement subtracts a sample the accumulator knows
 * about, but a defensive clamp keeps a corrupted fold from producing negative
 * call counts.
 */
export function applyCostSample(accumulator: CostAccumulator, sample: CostSample, direction: 1 | -1 = 1): void {
  if (sample.counted !== true) return
  if (sample.complete !== true) {
    accumulator.unpricedCalls = Math.max(0, accumulator.unpricedCalls + direction)
    return
  }
  accumulator.pricedCalls = Math.max(0, accumulator.pricedCalls + direction)
  accumulator.ruleIds.add(sample.ruleId)
  const previous = accumulator.amounts.get(sample.currency) ?? 0
  const next = previous + direction * sample.amount
  if (next === 0) accumulator.amounts.delete(sample.currency)
  else accumulator.amounts.set(sample.currency, next)
}

/** Merge one accumulator into another. */
export function mergeCost(into: CostAccumulator, from: CostAccumulator): CostAccumulator {
  into.pricedCalls += from.pricedCalls
  into.unpricedCalls += from.unpricedCalls
  for (const [currency, amount] of from.amounts) {
    const next = (into.amounts.get(currency) ?? 0) + amount
    if (next === 0) into.amounts.delete(currency)
    else into.amounts.set(currency, next)
  }
  if (from.pricedCalls > 0) for (const ruleId of from.ruleIds) into.ruleIds.add(ruleId)
  return into
}

/** Round to micro-units so wire output stays readable. */
function roundAmount(amount: number): number {
  return Math.round(amount * 1_000_000) / 1_000_000
}

/**
 * Render an accumulator.
 *
 * The amount is withheld unless every counted sample is priced in exactly one
 * currency — a partial sum presented as a total is worse than no sum.
 */
export function renderCost(accumulator: CostAccumulator): CostRender {
  const complete = accumulator.unpricedCalls === 0 && accumulator.amounts.size <= 1
  const entry = complete ? [...accumulator.amounts.entries()][0] : undefined
  return {
    amount: complete ? (entry === undefined ? 0 : roundAmount(entry[1])) : null,
    currency: entry?.[0] ?? null,
    complete,
    pricedCalls: accumulator.pricedCalls,
    unpricedCalls: accumulator.unpricedCalls,
    ruleIds: [...accumulator.ruleIds].sort(),
  }
}

/** The JSON-safe cost of one already-priced sample. */
export function renderSampleCost(sample: CostSample): CostRender {
  if (sample.counted !== true) {
    return { amount: 0, currency: null, complete: true, pricedCalls: 0, unpricedCalls: 0, ruleIds: [] }
  }
  if (sample.complete !== true) {
    return { amount: null, currency: null, complete: false, pricedCalls: 0, unpricedCalls: 1, ruleIds: [] }
  }
  return {
    amount: roundAmount(sample.amount),
    currency: sample.currency,
    complete: true,
    pricedCalls: 1,
    unpricedCalls: 0,
    ruleIds: [sample.ruleId],
  }
}
