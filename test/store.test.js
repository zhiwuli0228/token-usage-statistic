import assert from 'node:assert/strict'
import test from 'node:test'

import { UsageStore, modelKey, resolveRange, splitModelKey } from '../src/host/store.js'
import { dayKey, testRecord } from './helpers.js'

test('modelKey round-trips through splitModelKey', () => {
  const key = modelKey('deepseek', 'deepseek-chat')
  assert.deepEqual(splitModelKey(key), { provider: 'deepseek', model: 'deepseek-chat' })
})

test('a new store is empty', () => {
  const store = new UsageStore()
  const snapshot = store.snapshot({ days: 30 })
  assert.equal(snapshot.totals.calls, 0)
  assert.deepEqual(snapshot.byModel, [])
  assert.deepEqual(snapshot.byDay, [])
  assert.deepEqual(snapshot.sessions, [])
  assert.deepEqual(snapshot.recent, [])
})

test('apply folds one record into every view', () => {
  const store = new UsageStore()
  const time = Date.now()
  assert.equal(store.apply(testRecord({ time, sessionId: 's1', seq: 1 })), true)

  const snapshot = store.snapshot({ days: 30, now: time })
  assert.equal(snapshot.totals.calls, 1)
  assert.equal(snapshot.totals.inputTokens, 1000)
  assert.equal(snapshot.totals.outputTokens, 250)
  assert.equal(snapshot.totals.cacheReadTokens, 400)
  assert.equal(snapshot.totals.totalTokens, 1250)
  assert.equal(snapshot.byModel.length, 1)
  assert.equal(snapshot.byModel[0].model, 'deepseek-chat')
  assert.equal(snapshot.byDay.length, 1)
  assert.equal(snapshot.byDay[0].day, dayKey(time))
  assert.equal(snapshot.sessions.length, 1)
  assert.equal(snapshot.sessions[0].sessionId, 's1')
  assert.equal(snapshot.recent.length, 1)
  assert.equal(snapshot.counts.records, 1)
})

test('apply rejects invalid records and counts them', () => {
  const store = new UsageStore()
  assert.equal(store.apply(null), false)
  assert.equal(store.apply({ sessionId: 's' }), false)
  assert.equal(
    store.apply(
      testRecord({
        usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, totalTokens: 0 },
      }),
    ),
    false,
  )
  assert.equal(store.snapshot().totals.calls, 0)
  assert.equal(store.snapshot().counts.skipped, 3)
})

test('apply deduplicates one committed event replayed twice', () => {
  const store = new UsageStore()
  const record = testRecord({ time: Date.now(), sessionId: 's1', seq: 9 })
  assert.equal(store.apply(record), true)
  assert.equal(store.apply(record), false)
  assert.equal(store.apply({ ...record, time: record.time + 1 }), false)
  const snapshot = store.snapshot()
  assert.equal(snapshot.totals.calls, 1)
  assert.equal(snapshot.counts.duplicates, 2)
})

test('the same seq in a different session is a different call', () => {
  const store = new UsageStore()
  store.apply(testRecord({ sessionId: 'a', seq: 1 }))
  store.apply(testRecord({ sessionId: 'b', seq: 1 }))
  assert.equal(store.snapshot().totals.calls, 2)
})

test('models are keyed by provider and sorted by total tokens', () => {
  const store = new UsageStore()
  store.apply(testRecord({ sessionId: 's', seq: 1, provider: 'p1', model: 'small', usage: { totalTokens: 10, inputTokens: 10, outputTokens: 0 } }))
  store.apply(testRecord({ sessionId: 's', seq: 2, provider: 'p1', model: 'big', usage: { totalTokens: 100, inputTokens: 100, outputTokens: 0 } }))
  store.apply(testRecord({ sessionId: 's', seq: 3, provider: 'p2', model: 'small', usage: { totalTokens: 50, inputTokens: 50, outputTokens: 0 } }))

  const byModel = store.snapshot().byModel
  assert.deepEqual(
    byModel.map((entry) => [entry.provider, entry.model, entry.calls]),
    [
      ['p1', 'big', 1],
      ['p2', 'small', 1],
      ['p1', 'small', 1],
    ],
  )
})

test('days are sorted newest first and split by local day', () => {
  const store = new UsageStore()
  const today = Date.now()
  const yesterday = today - 24 * 60 * 60 * 1000
  store.apply(testRecord({ time: yesterday, sessionId: 's', seq: 1 }))
  store.apply(testRecord({ time: today, sessionId: 's', seq: 2 }))

  const byDay = store.snapshot({ days: 30 }).byDay
  assert.equal(byDay.length, 2)
  assert.equal(byDay[0].day, dayKey(today))
  assert.equal(byDay[1].day, dayKey(yesterday))
})

test('a trailing window excludes older days', () => {
  const store = new UsageStore()
  const now = Date.now()
  store.apply(testRecord({ time: now - 30 * 24 * 60 * 60 * 1000, sessionId: 's', seq: 1 }))
  store.apply(testRecord({ time: now, sessionId: 's', seq: 2 }))

  assert.equal(store.snapshot({ days: 7, now }).totals.calls, 1)
  assert.equal(store.snapshot({ days: null, now }).totals.calls, 2)
})

test('sessions are ranked by total tokens and limited', () => {
  const store = new UsageStore()
  store.apply(testRecord({ sessionId: 'small', seq: 1, usage: { totalTokens: 10, inputTokens: 10, outputTokens: 0 } }))
  store.apply(testRecord({ sessionId: 'big', seq: 1, usage: { totalTokens: 100, inputTokens: 100, outputTokens: 0 } }))
  store.apply(testRecord({ sessionId: 'mid', seq: 1, usage: { totalTokens: 50, inputTokens: 50, outputTokens: 0 } }))

  const sessions = store.snapshot({ sessionLimit: 2 }).sessions
  assert.deepEqual(
    sessions.map((entry) => entry.sessionId),
    ['big', 'mid'],
  )
})

test('recent records are newest first and filtered by range', () => {
  const store = new UsageStore()
  const now = Date.now()
  store.apply(testRecord({ time: now - 10 * 24 * 60 * 60 * 1000, sessionId: 'old', seq: 1 }))
  store.apply(testRecord({ time: now, sessionId: 'new', seq: 1 }))

  const recent = store.snapshot({ days: 7, now, recentLimit: 10 }).recent
  assert.equal(recent.length, 1)
  assert.equal(recent[0].sessionId, 'new')
})

test('recent keeps a bounded rolling window', () => {
  const store = new UsageStore({ recentLimit: 2 })
  const now = Date.now()
  for (let index = 0; index < 5; index += 1) {
    store.apply(testRecord({ time: now + index, sessionId: 's', seq: index }))
  }
  assert.equal(store.recent.length, 2)
  assert.equal(store.snapshot({ recentLimit: 5 }).recent.length, 2)
})

test('resolveRange treats zero and null as all time', () => {
  assert.equal(resolveRange(0, Date.now()), null)
  assert.equal(resolveRange(null, Date.now()), null)
  assert.deepEqual(resolveRange(1, new Date(2026, 9, 31, 12, 0, 0).getTime()), {
    days: 1,
    from: '2026-10-31',
    to: '2026-10-31',
  })
})

test('snapshot is JSON-safe and detached from the fold', () => {
  const store = new UsageStore()
  store.apply(testRecord({ sessionId: 's', seq: 1 }))
  const snapshot = store.snapshot()
  const text = JSON.stringify(snapshot)
  const parsed = JSON.parse(text)
  assert.equal(parsed.totals.calls, 1)

  snapshot.totals.calls = 999
  assert.equal(store.snapshot().totals.calls, 1)
})
