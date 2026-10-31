import assert from 'node:assert/strict'
import test from 'node:test'

import { API_PREFIX, createHttpHandler, parseDays, parseLimit } from '../src/host/http.js'
import { UsageStore } from '../src/host/store.js'
import { testRecord } from './helpers.js'

function fakeResponse() {
  const state = { status: 0, headers: {}, body: '' }
  return {
    state,
    writeHead(status, headers) {
      state.status = status
      Object.assign(state.headers, headers)
      return this
    },
    end(payload) {
      if (payload !== undefined) state.body = payload
      return this
    },
  }
}

function call(handler, method, url) {
  const response = fakeResponse()
  handler({ method, url }, response)
  return response.state
}

test('parseDays covers defaults, all time and bounds', () => {
  assert.equal(parseDays(null), 30)
  assert.equal(parseDays(''), 30)
  assert.equal(parseDays('all'), null)
  assert.equal(parseDays('7'), 7)
  assert.equal(parseDays('-1'), 30)
  assert.equal(parseDays('abc'), 30)
  assert.equal(parseDays('99999'), 3650)
})

test('parseLimit bounds table sizes', () => {
  assert.equal(parseLimit(null, 12, 50), 12)
  assert.equal(parseLimit('5', 12, 50), 5)
  assert.equal(parseLimit('500', 12, 50), 50)
  assert.equal(parseLimit('0', 12, 50), 12)
})

test('the summary route answers the panel payload', () => {
  const store = new UsageStore()
  const now = Date.now()
  store.apply(testRecord({ time: now, sessionId: 's1', seq: 1 }))
  const handler = createHttpHandler({ store, config: { refreshMs: 20000 }, now: () => now })

  const state = call(handler, 'GET', `${API_PREFIX}api/summary?days=7&sessions=5&recent=5`)
  assert.equal(state.status, 200)
  assert.match(state.headers['content-type'], /application\/json/)
  assert.equal(state.headers['cache-control'], 'no-store')

  const body = JSON.parse(state.body)
  assert.equal(body.totals.calls, 1)
  assert.equal(body.config.refreshMs, 20000)
  assert.equal(body.range.days, 7)
  assert.equal(body.byModel.length, 1)
})

test('unknown paths and unsupported methods are reported', () => {
  const store = new UsageStore()
  const handler = createHttpHandler({ store })

  assert.equal(call(handler, 'GET', `${API_PREFIX}api/other`).status, 404)
  assert.equal(call(handler, 'GET', '/api/summary').status, 404)

  const methodState = call(handler, 'POST', `${API_PREFIX}api/summary`)
  assert.equal(methodState.status, 405)
  assert.equal(methodState.headers.allow, 'GET, HEAD')
})

test('HEAD answers headers without a body', () => {
  const store = new UsageStore()
  const handler = createHttpHandler({ store })
  const state = call(handler, 'HEAD', `${API_PREFIX}api/summary`)
  assert.equal(state.status, 200)
  assert.equal(state.body, '')
  assert.ok(Number(state.headers['content-length']) > 0)
})

test('a store failure becomes a 500 instead of a crash', () => {
  const handler = createHttpHandler({
    store: {
      snapshot() {
        throw new Error('boom')
      },
    },
  })
  const state = call(handler, 'GET', `${API_PREFIX}api/summary`)
  assert.equal(state.status, 500)
  assert.match(JSON.parse(state.body).message, /boom/)
})
