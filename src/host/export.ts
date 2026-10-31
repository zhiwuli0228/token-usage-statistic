/**
 * Secret-free export projections.
 *
 * Export accepts only normalized usage rows, account views and budget state —
 * never config, credentials, headers or raw upstream responses. CSV output is
 * Excel-safe: UTF-8 BOM, CRLF rows, quoted cells, and a leading apostrophe for
 * text that begins with a formula sigil.
 */

import type { AccountView, BudgetState } from './accounts/types.js'
import type { UsageStore } from './store.js'

export const EXPORT_SCHEMA_VERSION = '1.0.0'

const CSV_FORMULA_PREFIX = /^[\t\r\n ]*[=+\-@]/

function csvCell(value: unknown, text = false): string {
  if (value === null || value === undefined) return '""'
  let rendered = String(value)
  if (text && CSV_FORMULA_PREFIX.test(rendered)) rendered = `'${rendered}`
  return `"${rendered.replaceAll('"', '""')}"`
}

function csv(rows: Array<Array<{ value: unknown; text?: boolean }>>): string {
  return `\uFEFF${rows.map((row) => row.map((cell) => csvCell(cell.value, cell.text)).join(',')).join('\r\n')}\r\n`
}

function numeric(value: number | null | undefined): number | string {
  return typeof value === 'number' && Number.isFinite(value) ? value : ''
}

/** One row per day/provider/model. */
export function dailyCsv(store: UsageStore): string {
  const rows: Array<Array<{ value: unknown; text?: boolean }>> = [[
    { value: 'date' },
    { value: 'provider' },
    { value: 'model' },
    { value: 'calls' },
    { value: 'input_tokens' },
    { value: 'cache_read_tokens' },
    { value: 'cache_write_tokens' },
    { value: 'output_tokens' },
    { value: 'total_tokens' },
    { value: 'cache_hit_rate' },
    { value: 'estimated_cost' },
    { value: 'currency' },
    { value: 'cost_complete' },
  ]]
  for (const row of store.dailyRows()) {
    rows.push([
      { value: row.day, text: true },
      { value: row.provider, text: true },
      { value: row.model, text: true },
      { value: row.calls },
      { value: row.input },
      { value: row.cacheRead },
      { value: row.cacheWrite },
      { value: row.output },
      { value: row.tokens },
      { value: numeric(row.cacheHitRate) },
      { value: row.cost.complete ? numeric(row.cost.amount) : '' },
      { value: row.cost.complete ? row.cost.currency : '', text: true },
      { value: row.cost.complete },
    ])
  }
  return csv(rows)
}

/** One row per session. */
export function sessionsCsv(store: UsageStore): string {
  const rows: Array<Array<{ value: unknown; text?: boolean }>> = [[
    { value: 'session_id' },
    { value: 'providers' },
    { value: 'models' },
    { value: 'calls' },
    { value: 'input_tokens' },
    { value: 'cache_read_tokens' },
    { value: 'cache_write_tokens' },
    { value: 'output_tokens' },
    { value: 'total_tokens' },
    { value: 'cache_hit_rate' },
    { value: 'estimated_cost' },
    { value: 'currency' },
    { value: 'cost_complete' },
    { value: 'first_at' },
    { value: 'last_at' },
  ]]
  for (const row of store.sessionRows()) {
    rows.push([
      { value: row.sessionId, text: true },
      { value: row.providers.join(' | '), text: true },
      { value: row.models.join(' | '), text: true },
      { value: row.calls },
      { value: row.input },
      { value: row.cacheRead },
      { value: row.cacheWrite },
      { value: row.output },
      { value: row.tokens },
      { value: numeric(row.cacheHitRate) },
      { value: row.cost.complete ? numeric(row.cost.amount) : '' },
      { value: row.cost.complete ? row.cost.currency : '', text: true },
      { value: row.cost.complete },
      { value: new Date(row.firstAt).toISOString(), text: true },
      { value: new Date(row.lastAt).toISOString(), text: true },
    ])
  }
  return csv(rows)
}

/** Versioned JSON export with an explicit field allow-list. */
export function jsonExport(options: {
  store: UsageStore
  accounts: AccountView[]
  budgets: BudgetState
  exportedAt?: number
}): Record<string, unknown> {
  const { store } = options
  const exportedAt = options.exportedAt ?? Date.now()
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date(exportedAt).toISOString(),
    pricing: { catalogUpdatedAt: store.pricingCatalogUpdatedAt() },
    days: store.dailyRows().map((row) => ({
      date: row.day,
      provider: row.provider,
      model: row.model,
      calls: row.calls,
      tokens: { input: row.input, cacheRead: row.cacheRead, cacheWrite: row.cacheWrite, output: row.output, total: row.tokens },
      cacheHitRate: row.cacheHitRate,
      cost: { amount: row.cost.complete ? row.cost.amount : null, currency: row.cost.complete ? row.cost.currency : null, complete: row.cost.complete },
    })),
    sessions: store.sessionRows().map((row) => ({
      sessionId: row.sessionId,
      providers: row.providers,
      models: row.models,
      calls: row.calls,
      tokens: { input: row.input, cacheRead: row.cacheRead, cacheWrite: row.cacheWrite, output: row.output, total: row.tokens },
      cacheHitRate: row.cacheHitRate,
      cost: { amount: row.cost.complete ? row.cost.amount : null, currency: row.cost.complete ? row.cost.currency : null, complete: row.cost.complete },
      firstAt: new Date(row.firstAt).toISOString(),
      lastAt: new Date(row.lastAt).toISOString(),
    })),
    budgets: options.budgets,
    accounts: options.accounts.map((account) => ({
      id: account.id,
      displayName: account.displayName,
      mode: account.mode,
      adapter: account.adapter,
      configured: account.configured,
      status: account.status,
      stale: account.stale,
      fetchedAt: account.fetchedAt,
      lastError: account.lastError,
      balance: account.balance
        ? {
            currency: account.balance.currency,
            total: account.balance.total,
            used: account.balance.used,
            limit: account.balance.limit,
            granted: account.balance.granted,
            toppedUp: account.balance.toppedUp,
          }
        : undefined,
      subscription: account.subscription
        ? { plan: account.subscription.plan, windows: account.subscription.windows }
        : undefined,
    })),
  }
}
