import { describe, expect, it, vi } from 'vitest'

import { IDLE_BACKFILL, ROUTES, createHttpHandler, isLoopbackRequest, parseDays, parseLimit } from '../src/host/api.js'
import type { BudgetState } from '../src/host/accounts/types.js'
import type { UsageStore } from '../src/host/store.js'

function fakeResponse() {
  const state = { status: 0, headers: {} as Record<string, string>, body: '' }
  return {
    state,
    writeHead(status: number, headers: Record<string, string>) {
      state.status = status
      Object.assign(state.headers, headers)
      return this
    },
    end(payload?: string) {
      if (payload !== undefined) state.body = payload
      return this
    },
  }
}

async function call(handler: (request: any, response: any) => void | Promise<void>, method: string, url: string, remoteAddress?: string) {
  const response = fakeResponse()
  await handler({ method, url, ...(remoteAddress === undefined ? {} : { socket: { remoteAddress } }) }, response)
  return response.state
}

const budgets: BudgetState = {
  currency: 'USD',
  daily: { limit: 5, currency: 'USD', spend: 1.5, percent: 30, costComplete: true, level: 'ok' },
  monthly: { limit: 50, currency: 'USD', spend: 12, percent: 24, costComplete: true, level: 'ok' },
}

function storeStub(overrides: Record<string, unknown> = {}) {
  return {
    snapshot: vi.fn(() => ({ ok: true })),
    sessionIds: () => ['session-1'],
    dailyDetails: vi.fn(() => ({
      schemaVersion: 2,
      generatedAt: 1234,
      range: { days: 1, from: '2026-10-31', to: '2026-10-31' },
      days: [
        {
          day: '2026-10-31',
          calls: 2,
          input: 10,
          output: 5,
          cacheRead: 20,
          cacheWrite: 0,
          tokens: 35,
          cacheHitRate: 66.7,
          cost: { amount: 0.5, currency: 'USD', complete: true, pricedCalls: 2, unpricedCalls: 0, ruleIds: ['r'] },
          sessions: [],
          models: [],
        },
      ],
    })),
    dailyRows: () => [
      {
        day: '2026-10-31',
        provider: 'deepseek',
        model: 'deepseek-flash',
        calls: 2,
        input: 10,
        output: 5,
        cacheRead: 20,
        cacheWrite: 0,
        tokens: 35,
        cacheHitRate: 66.7,
        cost: { amount: 0.5, currency: 'USD', complete: true, pricedCalls: 2, unpricedCalls: 0, ruleIds: ['r'] },
      },
    ],
    sessionRows: () => [
      {
        sessionId: 'session-1',
        providers: ['deepseek'],
        models: ['deepseek/deepseek-flash'],
        calls: 2,
        input: 10,
        output: 5,
        cacheRead: 20,
        cacheWrite: 0,
        tokens: 35,
        cacheHitRate: 66.7,
        cost: { amount: 0.5, currency: 'USD', complete: true, pricedCalls: 2, unpricedCalls: 0, ruleIds: ['r'] },
        firstAt: 1,
        lastAt: 2,
      },
    ],
    pricingCatalogUpdatedAt: () => '2026-08-23T00:00:00.000Z',
    ...overrides,
  } as unknown as UsageStore
}

function handlerWith(options: { store?: UsageStore; refresh?: () => void } = {}) {
  return createHttpHandler({
    store: options.store ?? storeStub(),
    backfill: () => IDLE_BACKFILL,
    accounts: () => ({ schemaVersion: 1, generatedAt: 1, refreshMs: 600000, refreshing: false, accounts: [] }),
    budgets: () => budgets,
    sessionNames: { refresh: vi.fn(async () => {}), get: () => ({}) },
    refreshAccounts: options.refresh ?? (() => {}),
    refreshMs: 20000,
    now: () => 1234,
  })
}

describe('query parsing', () => {
  it('parses days including all time', () => {
    expect(parseDays(null)).toBe(30)
    expect(parseDays('all')).toBeNull()
    expect(parseDays('99999')).toBe(3650)
  })

  it('bounds table sizes', () => {
    expect(parseLimit('500', 12, 50)).toBe(50)
    expect(parseLimit('-2', 12, 50)).toBe(12)
  })
})

describe('loopback guard', () => {
  it('trusts an absent peer and loopback addresses', () => {
    expect(isLoopbackRequest({} as never)).toBe(true)
    expect(isLoopbackRequest({ socket: { remoteAddress: '127.0.0.1' } } as never)).toBe(true)
    expect(isLoopbackRequest({ socket: { remoteAddress: '::1' } } as never)).toBe(true)
    expect(isLoopbackRequest({ socket: { remoteAddress: '::ffff:127.0.0.1' } } as never)).toBe(true)
  })

  it('rejects a remote peer', async () => {
    expect(isLoopbackRequest({ socket: { remoteAddress: '10.1.2.3' } } as never)).toBe(false)
    const response = await call(handlerWith(), 'GET', ROUTES.summary, '10.1.2.3')
    expect(response.status).toBe(403)
  })
})

describe('summary route', () => {
  it('serves the snapshot with budgets for the requested range', async () => {
    const store = storeStub()
    const handler = handlerWith({ store })
    const response = await call(handler, 'GET', `${ROUTES.summary}?days=7&sessions=5&recent=3`)

    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(store.snapshot).toHaveBeenCalledWith(
      expect.objectContaining({ days: 7, sessionLimit: 5, recentLimit: 3, now: 1234, budgets, refreshMs: 20000 }),
    )
  })

  it('does not wait for a slow session-name refresh', async () => {
    const handler = createHttpHandler({
      store: storeStub(),
      backfill: () => IDLE_BACKFILL,
      accounts: () => ({ schemaVersion: 1, generatedAt: 1, refreshMs: 600000, refreshing: false, accounts: [] }),
      budgets: () => budgets,
      sessionNames: { refresh: () => new Promise<void>(() => {}), get: () => ({}) },
      refreshAccounts: () => {},
      refreshMs: 20000,
      now: () => 1234,
    })
    const response = await call(handler, 'GET', `${ROUTES.summary}?days=7`)
    expect(response.status).toBe(200)
  })

  it('rejects unknown paths and methods', async () => {
    const handler = handlerWith()
    expect((await call(handler, 'GET', `${ROUTES.summary}/nope`)).status).toBe(404)
    expect((await call(handler, 'POST', ROUTES.summary)).status).toBe(405)
  })

  it('answers HEAD without a body', async () => {
    const response = await call(handlerWith(), 'HEAD', ROUTES.summary)
    expect(response.status).toBe(200)
    expect(response.body).toBe('')
  })

  it('converts a fold failure into a 500', async () => {
    const store = storeStub({
      snapshot: () => {
        throw new Error('boom')
      },
    })
    const response = await call(handlerWith({ store }), 'GET', ROUTES.summary)
    expect(response.status).toBe(500)
  })
})

describe('accounts route', () => {
  it('serves the account snapshot and triggers a refresh on demand', async () => {
    const refresh = vi.fn()
    const handler = handlerWith({ refresh })
    const response = await call(handler, 'GET', `${ROUTES.accounts}?refresh=1`)
    expect(response.status).toBe(200)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(JSON.parse(response.body)).toMatchObject({ schemaVersion: 1, accounts: [] })
  })
})

describe('daily route', () => {
  it('serves per-day details with sessions and models', async () => {
    const store = storeStub()
    const handler = handlerWith({ store })
    const response = await call(handler, 'GET', ROUTES.daily)
    expect(response.status).toBe(200)
    expect(store.dailyDetails).toHaveBeenCalledWith(expect.objectContaining({ days: 30 }))
    const body = JSON.parse(response.body)
    expect(body.days).toHaveLength(1)
    expect(body.days[0].day).toBe('2026-10-31')
  })
})

describe('export routes', () => {
  it('serves a BOM-prefixed daily CSV as a download', async () => {
    const response = await call(handlerWith(), 'GET', ROUTES.exportDaily)
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toMatch(/text\/csv/)
    expect(response.headers['content-disposition']).toContain('token-usage-daily.csv')
    expect(response.body.startsWith('\uFEFF')).toBe(true)
    expect(response.body).toContain('"2026-10-31","deepseek","deepseek-flash"')
  })

  it('serves a sessions CSV', async () => {
    const response = await call(handlerWith(), 'GET', ROUTES.exportSessions)
    expect(response.status).toBe(200)
    expect(response.body).toContain('"session-1"')
  })

  it('serves a versioned JSON export', async () => {
    const response = await call(handlerWith(), 'GET', ROUTES.exportJson)
    expect(response.status).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.schemaVersion).toBe('1.0.0')
    expect(body.days).toHaveLength(1)
    expect(body.budgets.daily.limit).toBe(5)
  })
})
