/**
 * Balance schemes and generic JSON mappings.
 *
 * A scheme knows the public endpoint path (relative to the provider's
 * configured base URL) and how to normalize its response into the shared
 * `AccountBalance` shape. Providers without a public balance interface map to
 * no scheme and are reported as unsupported instead of guessed.
 *
 * The generic mapping lets a user wire any private monitoring endpoint without
 * adding code: JSON Pointer paths select the numbers, and the same parsing and
 * validation apply.
 */

import { AccountError } from './net.js'
import type { AccountBalance, AccountSubscription, QuotaWindow } from './types.js'

/** Built-in balance schemes. */
export type BalanceSchemeId = 'deepseek' | 'moonshot' | 'zai' | 'openrouter' | 'orcarouter'

/** JSON Pointer value lookup (`/data/total`, `/items/0/balance`). */
export function pointerValue(root: unknown, pointer: string | undefined): unknown {
  if (pointer === undefined || pointer === '') return root
  if (!pointer.startsWith('/')) return undefined
  let current: unknown = root
  for (const raw of pointer.slice(1).split('/')) {
    const key = raw.replaceAll('~1', '/').replaceAll('~0', '~')
    if (Array.isArray(current)) {
      const index = Number(key)
      if (!Number.isInteger(index) || index < 0) return undefined
      current = current[index]
    } else if (current !== null && typeof current === 'object') {
      current = (current as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }
  return current
}

/** A finite number from a number or numeric string, else null. */
export function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

/** A non-empty string, else null. */
export function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function emptyBalance(currency: string | null = null): AccountBalance {
  return { currency, total: null, used: null, limit: null, granted: null, toppedUp: null, available: null }
}

/** The built-in scheme id for a provider, inferred from its literal host. */
export function schemeForProvider(providerId: string, baseURL: string | undefined): BalanceSchemeId | null {
  const id = providerId.toLowerCase()
  let host = ''
  if (typeof baseURL === 'string') {
    try {
      host = new URL(baseURL).hostname.toLowerCase()
    } catch {
      host = ''
    }
  }
  if (id.includes('deepseek') || host === 'api.deepseek.com') return 'deepseek'
  if (id.includes('moonshot') || host.includes('moonshot')) return 'moonshot'
  if (id.includes('zai') || id.includes('zhipu') || host.includes('z.ai') || host.includes('bigmodel.cn')) return 'zai'
  if (id.includes('openrouter') || host.includes('openrouter.ai')) return 'openrouter'
  if (id.includes('orcarouter') || host.includes('orcarouter')) return 'orcarouter'
  return null
}

function originOf(baseURL: string): URL {
  try {
    return new URL(baseURL)
  } catch {
    throw new AccountError('invalid-url', 'provider base URL is invalid')
  }
}

/** Absolute endpoint URL for one scheme. */
export function schemeURL(scheme: BalanceSchemeId, baseURL: string): string {
  const base = originOf(baseURL)
  switch (scheme) {
    case 'deepseek':
      return new URL('/user/balance', base.origin).href
    case 'moonshot':
      return new URL('/v1/users/me/balance', base.origin).href
    case 'zai':
      return new URL('/api/paas/v4/balance', base.origin).href
    case 'openrouter':
      return new URL('/api/v1/credits', base.origin).href
    case 'orcarouter': {
      const pathname = base.pathname.replace(/\/+$/, '')
      const prefix = pathname === '' ? '/v1' : pathname.endsWith('/v1') ? pathname : `${pathname}/v1`
      return new URL(`${prefix}/balance`, base.origin).href
    }
  }
}

function walletTotal(entries: unknown, currency: string): number {
  if (!Array.isArray(entries)) return 0
  let total = 0
  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const entryCurrency = stringOrNull(record.unit) ?? stringOrNull(record.currency) ?? currency
    if (entryCurrency.toUpperCase() !== currency) continue
    total += numberOrNull(record.balance_usd ?? record.balance ?? record.amount) ?? 0
  }
  return total
}

/**
 * Normalize one scheme's JSON response.
 *
 * A response with no usable number is an error rather than a zero balance: a
 * zero would read as "out of money" instead of "this endpoint changed".
 */
export function parseSchemeBalance(scheme: BalanceSchemeId, json: unknown): AccountBalance {
  const body = json !== null && typeof json === 'object' ? (json as Record<string, any>) : {}

  if (scheme === 'deepseek') {
    const infos = Array.isArray(body.balance_infos) ? body.balance_infos : []
    const info = infos.find((entry: any) => entry?.currency === 'CNY') ?? infos[0]
    const total = numberOrNull(info?.total_balance)
    if (total === null) throw new AccountError('invalid-response', 'DeepSeek balance response is missing total_balance')
    return {
      currency: stringOrNull(info?.currency),
      total,
      used: null,
      limit: null,
      granted: numberOrNull(info?.granted_balance),
      toppedUp: numberOrNull(info?.topped_up_balance),
      available: typeof body.is_available === 'boolean' ? body.is_available : total > 0,
    }
  }

  if (scheme === 'moonshot') {
    const data = body.data ?? {}
    const available = numberOrNull(data.available_balance)
    if (available === null) throw new AccountError('invalid-response', 'Moonshot balance response is missing available_balance')
    return {
      currency: stringOrNull(data.currency),
      total: available,
      used: null,
      limit: null,
      granted: numberOrNull(data.voucher_balance),
      toppedUp: numberOrNull(data.cash_balance),
      available: available > 0,
    }
  }

  if (scheme === 'zai') {
    const data = body.data ?? {}
    const total = numberOrNull(data.total_balance) ?? numberOrNull(data.available_balance)
    if (total === null) throw new AccountError('invalid-response', 'Z.ai balance response is missing total_balance')
    return {
      currency: stringOrNull(data.currency),
      total,
      used: null,
      limit: null,
      granted: null,
      toppedUp: numberOrNull(data.available_balance),
      available: total > 0,
    }
  }

  if (scheme === 'openrouter') {
    const totalCredits = numberOrNull(body.data?.total_credits)
    const totalUsage = numberOrNull(body.data?.total_usage)
    if (totalCredits === null || totalUsage === null) {
      throw new AccountError('invalid-response', 'OpenRouter credits response is missing totals')
    }
    const remaining = totalCredits - totalUsage
    return {
      currency: 'USD',
      total: remaining,
      used: totalUsage,
      limit: totalCredits,
      granted: null,
      toppedUp: null,
      available: remaining > 0,
    }
  }

  // orcarouter wallet: paid + free + promo credits in one unit.
  const currency = stringOrNull(body.unit)?.toUpperCase() ?? null
  const paid = numberOrNull(body.paid_balance)
  if (currency === null || paid === null) throw new AccountError('invalid-response', 'OrcaRouter wallet response is missing unit or paid_balance')
  const remaining = paid + walletTotal(body.free_credit, currency) + walletTotal(body.promo_credits, currency)
  return {
    currency,
    total: remaining,
    used: null,
    limit: null,
    granted: null,
    toppedUp: null,
    available: remaining > 0,
  }
}

/** A generic balance mapping; every field is a JSON Pointer. */
export interface GenericBalanceMapping {
  total?: string
  currency?: string
  used?: string
  limit?: string
  granted?: string
  toppedUp?: string
  available?: string
}

/** Apply a generic mapping; requires at least one numeric value. */
export function parseGenericBalance(json: unknown, mapping: GenericBalanceMapping): AccountBalance {
  const balance = emptyBalance(stringOrNull(pointerValue(json, mapping.currency)))
  balance.total = numberOrNull(pointerValue(json, mapping.total))
  balance.used = numberOrNull(pointerValue(json, mapping.used))
  balance.limit = numberOrNull(pointerValue(json, mapping.limit))
  balance.granted = numberOrNull(pointerValue(json, mapping.granted))
  balance.toppedUp = numberOrNull(pointerValue(json, mapping.toppedUp))
  const available = pointerValue(json, mapping.available)
  balance.available = typeof available === 'boolean' ? available : balance.total !== null ? balance.total > 0 : null
  if (balance.total === null && balance.used === null && balance.limit === null) {
    throw new AccountError('invalid-response', 'generic balance mapping produced no numeric value')
  }
  return balance
}

/** A generic subscription mapping; `windows` selects the window array. */
export interface GenericSubscriptionMapping {
  plan?: string
  windows: string
  fields: {
    id?: string
    label?: string
    used?: string
    limit?: string
    remaining?: string
    unit?: string
    resetAt?: string
  }
}

function windowOf(json: unknown, index: number, mapping: GenericSubscriptionMapping): QuotaWindow {
  const id = stringOrNull(pointerValue(json, mapping.fields.id)) ?? `window-${index + 1}`
  const label = stringOrNull(pointerValue(json, mapping.fields.label)) ?? id
  return {
    id,
    label,
    used: numberOrNull(pointerValue(json, mapping.fields.used)),
    limit: numberOrNull(pointerValue(json, mapping.fields.limit)),
    remaining: numberOrNull(pointerValue(json, mapping.fields.remaining)),
    unit: stringOrNull(pointerValue(json, mapping.fields.unit)),
    resetAt: stringOrNull(pointerValue(json, mapping.fields.resetAt)),
  }
}

/** Apply a generic subscription mapping. */
export function parseGenericSubscription(json: unknown, mapping: GenericSubscriptionMapping): AccountSubscription {
  const windows = pointerValue(json, mapping.windows)
  if (!Array.isArray(windows)) throw new AccountError('invalid-response', 'generic subscription mapping did not select a window array')
  return {
    plan: stringOrNull(pointerValue(json, mapping.plan)),
    windows: windows.map((entry, index) => windowOf(entry, index, mapping)),
  }
}
