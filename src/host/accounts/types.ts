/**
 * Account, subscription and budget values shared by the Host half and the wire.
 */

/** How an account reports its state. */
export type AccountMode = 'balance' | 'subscription'

/** Coarse state of one account row. */
export type AccountStatus = 'ok' | 'unconfigured' | 'unsupported' | 'error'

/** One money balance in one currency. */
export interface AccountBalance {
  currency: string | null
  total: number | null
  used: number | null
  limit: number | null
  granted: number | null
  toppedUp: number | null
  available: boolean | null
}

/** One quota window of a subscription plan. */
export interface QuotaWindow {
  id: string
  label: string
  used: number | null
  limit: number | null
  remaining: number | null
  unit: string | null
  resetAt: string | null
}

/** A subscription's normalized view. */
export interface AccountSubscription {
  plan: string | null
  windows: QuotaWindow[]
}

/** One account as the panel renders it. Never carries a credential. */
export interface AccountView {
  id: string
  displayName: string
  mode: AccountMode
  adapter: string
  configured: boolean
  status: AccountStatus
  stale: boolean
  fetchedAt: number | null
  lastAttemptAt: number | null
  lastError: string | null
  balance?: AccountBalance
  subscription?: AccountSubscription
  source: { kind: 'host-service' | 'http' | 'unsupported'; origin?: string }
}

/** The `GET /api/accounts` payload. */
export interface AccountsPayload {
  schemaVersion: 1
  generatedAt: number
  refreshMs: number
  refreshing: boolean
  accounts: AccountView[]
}

/** A configured spend limit and its current state. */
export interface BudgetWindow {
  limit: number | null
  currency: string
  spend: number | null
  percent: number | null
  costComplete: boolean
  level: 'ok' | 'warn' | 'exceeded' | null
}

/** Daily and monthly budget state for the local day/month. */
export interface BudgetState {
  currency: string
  daily: BudgetWindow
  monthly: BudgetWindow
}
