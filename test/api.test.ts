import { describe, expect, it, vi } from 'vitest'

import { IDLE_BACKFILL, SUMMARY_PATH, createHttpHandler, parseDays, parseLimit } from '../src/host/api.js'
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

function call(handler: (request: any, response: any) => void, method: string, url: string) {
  const response = fakeResponse()
  handler({ method, url }, response)
  return response.state
}

function storeStub(snapshot: (options: Record<string, unknown>) => unknown) {
  return { snapshot } as unknown as UsageStore
}

describe('query parsing', () => {
  it('parses days including all time', () => {
    expect(parseDays(null)).toBe(30)
    expect(parseDays('')).toBe(30)
    expect(parseDays('all')).toBeNull()
    expect(parseDays('1')).toBe(1)
    expect(parseDays('0')).toBe(30)
    expect(parseDays('soon')).toBe(30)
    expect(parseDays('99999')).toBe(3650)
  })

  it('bounds table sizes', () => {
    expect(parseLimit(null, 12, 50)).toBe(12)
    expect(parseLimit('5', 12, 50)).toBe(5)
    expect(parseLimit('500', 12, 50)).toBe(50)
    expect(parseLimit('-2', 12, 50)).toBe(12)
  })
})

describe('summary route', () => {
  it('serves the snapshot for the requested range', () => {
    const snapshot = vi.fn(() => ({ ok: true }))
    const handler = createHttpHandler({ store: storeStub(snapshot), backfill: () => IDLE_BACKFILL, refreshMs: 20000, now: () => 1234 })
    const response = call(handler, 'GET', `${SUMMARY_PATH}?days=7&sessions=5&recent=3`)

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toMatch(/application\/json/)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(JSON.parse(response.body)).toEqual({ ok: true })
    expect(snapshot).toHaveBeenCalledWith(
      expect.objectContaining({ days: 7, sessionLimit: 5, recentLimit: 3, now: 1234, refreshMs: 20000 }),
    )
  })

  it('rejects unknown paths and methods', () => {
    const handler = createHttpHandler({ store: storeStub(() => ({})), backfill: () => IDLE_BACKFILL, refreshMs: 15000 })
    expect(call(handler, 'GET', '/token-usage-statistic/api/other').status).toBe(404)
    expect(call(handler, 'POST', SUMMARY_PATH).status).toBe(405)
    expect(call(handler, 'PUT', SUMMARY_PATH).headers.allow).toBe('GET, HEAD')
  })

  it('answers HEAD without a body', () => {
    const handler = createHttpHandler({ store: storeStub(() => ({})), backfill: () => IDLE_BACKFILL, refreshMs: 15000 })
    const response = call(handler, 'HEAD', SUMMARY_PATH)
    expect(response.status).toBe(200)
    expect(response.body).toBe('')
  })

  it('converts a fold failure into a 500', () => {
    const handler = createHttpHandler({
      store: storeStub(() => {
        throw new Error('boom')
      }),
      backfill: () => IDLE_BACKFILL,
      refreshMs: 15000,
    })
    const response = call(handler, 'GET', SUMMARY_PATH)
    expect(response.status).toBe(500)
    expect(JSON.parse(response.body).message).toMatch(/boom/)
  })
})
