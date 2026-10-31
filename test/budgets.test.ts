import { describe, expect, it } from 'vitest'

import type { Pricer } from '../src/host/pricing.js'
import { UsageStore } from '../src/host/store.js'
import { budgetState, resolveBudgetConfig } from '../src/host/budgets.js'
import { makeSample } from './helpers.js'

function pricer(amount: number, currency = 'USD'): Pricer {
  return {
    estimate: () => ({ counted: true, complete: true, amount, currency, ruleId: 'test' }),
    rules: [],
    catalogUpdatedAt: '2026-08-23T00:00:00.000Z',
  }
}

function storeWith(costs: number[], options: { currency?: string; now?: number } = {}) {
  const store = new UsageStore({ pricer: pricer(1, options.currency ?? 'USD') })
  const now = options.now ?? Date.now()
  costs.forEach((_, index) => {
    store.apply(makeSample({ time: now, seq: index, sampleKey: `1:${index}` }))
  })
  return store
}

describe('budget config', () => {
  it('defaults to USD and no limits', () => {
    expect(resolveBudgetConfig(undefined)).toEqual({ currency: 'USD', daily: null, monthly: null })
  })

  it('accepts positive limits and rejects malformed values', () => {
    expect(resolveBudgetConfig({ currency: 'CNY', daily: 5, monthly: -1 })).toEqual({ currency: 'CNY', daily: 5, monthly: null })
    expect(resolveBudgetConfig({ currency: 'x', daily: 'a' })).toEqual({ currency: 'USD', daily: null, monthly: null })
  })
})

describe('budget state', () => {
  it('reports spend and level against the daily limit', () => {
    const store = storeWith([1, 1, 1])
    const state = budgetState(store, { currency: 'USD', daily: 2, monthly: 50 }, Date.now())
    expect(state.daily).toMatchObject({ limit: 2, spend: 3, percent: 150, costComplete: true, level: 'exceeded' })
    expect(state.monthly).toMatchObject({ limit: 50, spend: 3, percent: 6, level: 'ok' })
  })

  it('warns at eighty percent', () => {
    const store = storeWith([1, 1, 1, 1])
    const state = budgetState(store, { currency: 'USD', daily: 5, monthly: null }, Date.now())
    expect(state.daily.level).toBe('warn')
  })

  it('has no level without a limit', () => {
    const store = storeWith([1])
    const state = budgetState(store, { currency: 'USD', daily: null, monthly: null }, Date.now())
    expect(state.daily).toMatchObject({ limit: null, spend: 1, percent: null, level: null })
  })

  it('withholds spend and level when the cost is incomplete', () => {
    const store = storeWith([1], { currency: 'CNY' })
    const state = budgetState(store, { currency: 'USD', daily: 5, monthly: null }, Date.now())
    expect(state.daily).toMatchObject({ spend: null, percent: null, costComplete: false, level: null })
  })
})
