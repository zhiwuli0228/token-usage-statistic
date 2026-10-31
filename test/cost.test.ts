import { describe, expect, it } from 'vitest'

import { applyCostSample, createCostAccumulator, mergeCost, renderCost, renderSampleCost } from '../src/host/cost.js'

describe('cost accumulators', () => {
  it('renders an empty accumulator as complete zero', () => {
    expect(renderCost(createCostAccumulator())).toMatchObject({ amount: 0, currency: null, complete: true })
  })

  it('adds and subtracts priced samples', () => {
    const accumulator = createCostAccumulator()
    applyCostSample(accumulator, { counted: true, complete: true, amount: 0.5, currency: 'USD', ruleId: 'r1' })
    applyCostSample(accumulator, { counted: true, complete: true, amount: 0.25, currency: 'USD', ruleId: 'r2' })
    expect(renderCost(accumulator)).toMatchObject({ amount: 0.75, currency: 'USD', complete: true, pricedCalls: 2 })
    expect(renderCost(accumulator).ruleIds).toEqual(['r1', 'r2'])

    applyCostSample(accumulator, { counted: true, complete: true, amount: 0.5, currency: 'USD', ruleId: 'r1' }, -1)
    expect(renderCost(accumulator)).toMatchObject({ amount: 0.25, pricedCalls: 1 })
  })

  it('fails the total closed when any sample is unpriced', () => {
    const accumulator = createCostAccumulator()
    applyCostSample(accumulator, { counted: true, complete: true, amount: 1, currency: 'USD', ruleId: 'r' })
    applyCostSample(accumulator, { counted: true, complete: false })
    expect(renderCost(accumulator)).toMatchObject({ amount: null, complete: false, pricedCalls: 1, unpricedCalls: 1 })
  })

  it('fails the total closed when currencies mix', () => {
    const accumulator = createCostAccumulator()
    applyCostSample(accumulator, { counted: true, complete: true, amount: 1, currency: 'USD', ruleId: 'r' })
    applyCostSample(accumulator, { counted: true, complete: true, amount: 2, currency: 'CNY', ruleId: 'r' })
    expect(renderCost(accumulator)).toMatchObject({ amount: null, complete: false })
  })

  it('ignores uncounted samples', () => {
    const accumulator = createCostAccumulator()
    applyCostSample(accumulator, { counted: false })
    expect(renderCost(accumulator)).toMatchObject({ amount: 0, pricedCalls: 0, unpricedCalls: 0 })
  })

  it('merges accumulators', () => {
    const left = createCostAccumulator()
    const right = createCostAccumulator()
    applyCostSample(left, { counted: true, complete: true, amount: 1, currency: 'USD', ruleId: 'a' })
    applyCostSample(right, { counted: true, complete: true, amount: 2, currency: 'USD', ruleId: 'b' })
    mergeCost(left, right)
    expect(renderCost(left)).toMatchObject({ amount: 3, pricedCalls: 2 })
    expect(renderCost(left).ruleIds).toEqual(['a', 'b'])
  })

  it('renders one priced or unpriced sample', () => {
    expect(
      renderSampleCost({ counted: true, complete: true, amount: 0.0123456, currency: 'USD', ruleId: 'r' }),
    ).toMatchObject({ amount: 0.012346, currency: 'USD', complete: true })
    expect(renderSampleCost({ counted: true, complete: false })).toMatchObject({ amount: null, complete: false })
    expect(renderSampleCost({ counted: false })).toMatchObject({ amount: 0, complete: true })
  })
})
