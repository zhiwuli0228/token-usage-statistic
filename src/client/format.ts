/**
 * Number, money and time formatting for the panel.
 *
 * Formatters are created once: `Intl.NumberFormat` construction is the
 * expensive part, and the panel renders on every poll.
 */

import type { CostRender } from '../host/types.js'

const integerFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
const compactFormat = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

/** Grouped integer, or `0` for a missing value. */
export function formatInteger(value: number | null | undefined): string {
  return integerFormat.format(typeof value === 'number' && Number.isFinite(value) ? value : 0)
}

/** Compact count such as `12.3k`, for metric cards. */
export function formatCompact(value: number | null | undefined): string {
  return compactFormat.format(typeof value === 'number' && Number.isFinite(value) ? value : 0)
}

/**
 * A cost render as money.
 *
 * An unpriced total (`amount === null`) is an em dash, never a partial number:
 * the caller shows why next to it.
 */
export function formatCost(cost: CostRender | undefined | null): string {
  if (cost === undefined || cost === null) return '—'
  if (cost.amount === null) return '—'
  if (cost.currency === null) return cost.amount === 0 ? '0' : String(cost.amount)
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: cost.currency,
      maximumFractionDigits: cost.amount !== 0 && Math.abs(cost.amount) < 1 ? 4 : 2,
    }).format(cost.amount)
  } catch {
    return `${cost.amount} ${cost.currency}`
  }
}

/** Cache hit rate as a percentage. */
export function formatPercent(rate: number | null | undefined): string {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) return '—'
  return `${rate.toFixed(1)}%`
}

/** Money or quota amount in a named currency. */
export function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—'
  if (currency === null || currency === undefined) return formatInteger(amount)
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: amount !== 0 && Math.abs(amount) < 1 ? 4 : 2,
    }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

/** Local time of day. */
export function formatClock(time: number | null | undefined): string {
  const date = new Date(typeof time === 'number' && Number.isFinite(time) ? time : Date.now())
  try {
    return date.toLocaleTimeString()
  } catch {
    return date.toISOString()
  }
}

/** Local date and time. */
export function formatDateTime(time: number | null | undefined): string {
  const date = new Date(typeof time === 'number' && Number.isFinite(time) ? time : Date.now())
  try {
    return date.toLocaleString()
  } catch {
    return date.toISOString()
  }
}

/** Shorten a session id while keeping both ends recognizable. */
export function shortSessionId(sessionId: string): string {
  if (sessionId.length <= 24) return sessionId
  return `${sessionId.slice(0, 12)}…${sessionId.slice(-6)}`
}
