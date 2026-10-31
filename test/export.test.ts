import { describe, expect, it } from 'vitest'

import type { Pricer } from '../src/host/pricing.js'
import { UsageStore } from '../src/host/store.js'
import { dailyCsv, jsonExport, sessionsCsv } from '../src/host/export.js'
import type { BudgetState } from '../src/host/accounts/types.js'
import { makeSample } from './helpers.js'

const pricer: Pricer = {
  estimate: () => ({ counted: true, complete: true, amount: 0.25, currency: 'USD', ruleId: 'test' }),
  rules: [],
  catalogUpdatedAt: '2026-08-23T00:00:00.000Z',
}

const budgets: BudgetState = {
  currency: 'USD',
  daily: { limit: 5, currency: 'USD', spend: 0.25, percent: 5, costComplete: true, level: 'ok' },
  monthly: { limit: null, currency: 'USD', spend: 0.25, percent: null, costComplete: true, level: null },
}

function storeWithSample(provider = 'deepseek') {
  const store = new UsageStore({ pricer })
  const now = Date.now()
  store.apply(makeSample({ time: now, provider, model: 'deepseek-flash', seq: 1, sampleKey: '1:1' }))
  return store
}

describe('CSV export', () => {
  it('starts with a BOM and uses CRLF', () => {
    const csv = dailyCsv(storeWithSample())
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('\r\n')
    expect(csv).toContain('"date","provider","model"')
  })

  it('neutralizes a formula-shaped text cell', () => {
    const csv = dailyCsv(storeWithSample('=evil'))
    expect(csv).toContain('"\'=evil"')
  })

  it('escapes quotes inside a cell', () => {
    const store = storeWithSample('quote"provider')
    const csv = dailyCsv(store)
    expect(csv).toContain('"quote""provider"')
  })

  it('renders a sessions row with joined providers and models', () => {
    const csv = sessionsCsv(storeWithSample())
    expect(csv).toContain('"session-test"')
  })
})

describe('JSON export', () => {
  it('produces a versioned allow-listed document', () => {
    const store = storeWithSample()
    const document = jsonExport({
      store,
      accounts: [
        {
          id: 'deepseek-account',
          displayName: 'DeepSeek Account',
          mode: 'balance',
          adapter: 'host',
          configured: true,
          status: 'ok',
          stale: false,
          fetchedAt: 1,
          lastAttemptAt: 1,
          lastError: null,
          balance: { currency: 'CNY', total: 10, used: null, limit: null, granted: 2, toppedUp: 8, available: true },
          source: { kind: 'host-service' },
        },
      ],
      budgets,
      exportedAt: 1_800_000_000_000,
    })

    expect(document.schemaVersion).toBe('1.0.0')
    expect(document.exportedAt).toBe('2027-01-15T08:00:00.000Z')
    const days = document.days as Array<Record<string, unknown>>
    expect(days).toHaveLength(1)
    expect(days[0]).toMatchObject({ provider: 'deepseek', model: 'deepseek-flash', calls: 1 })
    const sessions = document.sessions as Array<Record<string, unknown>>
    expect(sessions[0]).toMatchObject({ sessionId: 'session-test' })
    expect((document.accounts as Array<Record<string, unknown>>)[0]).toMatchObject({ id: 'deepseek-account' })
    expect(document.budgets).toMatchObject({ currency: 'USD' })
  })
})
