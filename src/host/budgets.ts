/**
 * Daily and monthly spend budgets over the usage fold's own cost accumulators.
 *
 * A budget never re-prices anything: it sums the same per-sample estimates the
 * panel already shows. When any sample in the window is unpriced the window
 * reports `costComplete: false` and withholds a level instead of comparing a
 * partial sum against a limit.
 */

import { mergeCost, createCostAccumulator, renderCost } from './cost.js'
import type { BudgetState, BudgetWindow } from './accounts/types.js'
import type { UsageStore } from './store.js'
import { dayKey } from './usage.js'

export interface BudgetConfig {
  currency: string
  daily: number | null
  monthly: number | null
}

const WARN_AT = 80

/** Normalize the `budgets` config block. */
export function resolveBudgetConfig(value: unknown): BudgetConfig {
  const config = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const currency = typeof config.currency === 'string' && /^[A-Z]{3}$/.test(config.currency) ? config.currency : 'USD'
  const limit = (raw: unknown): number | null => {
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }
  return { currency, daily: limit(config.daily), monthly: limit(config.monthly) }
}

function windowOf(limit: number | null, currency: string, accumulator: ReturnType<typeof createCostAccumulator>): BudgetWindow {
  const rendered = renderCost(accumulator)
  const sameCurrency = rendered.currency === null || rendered.currency === currency
  const costComplete = rendered.complete && sameCurrency
  const spend = rendered.amount
  const percent = limit !== null && spend !== null ? Math.round((spend / limit) * 1000) / 10 : null
  if (!costComplete) {
    return { limit, currency, spend: null, percent: null, costComplete, level: null }
  }
  const level: BudgetWindow['level'] = limit !== null && percent !== null ? (percent >= 100 ? 'exceeded' : percent >= WARN_AT ? 'warn' : 'ok') : null
  return {
    limit,
    currency,
    spend,
    percent,
    costComplete,
    level,
  }
}

/** Compute the current local day and month budget state. */
export function budgetState(store: UsageStore, config: BudgetConfig, now: number = Date.now()): BudgetState {
  const day = dayKey(now)
  const month = day.slice(0, 7)
  const daily = store.costBetween(day, day)
  const monthly = store.costBetween(`${month}-01`, day)
  return {
    currency: config.currency,
    daily: windowOf(config.daily, config.currency, daily),
    monthly: windowOf(config.monthly, config.currency, monthly),
  }
}

/** An all-unset budget state for deployments without budget config. */
export function emptyBudgetState(currency = 'USD'): BudgetState {
  return {
    currency,
    daily: { limit: null, currency, spend: 0, percent: null, costComplete: true, level: null },
    monthly: { limit: null, currency, spend: 0, percent: null, costComplete: true, level: null },
  }
}

export { mergeCost, createCostAccumulator }
