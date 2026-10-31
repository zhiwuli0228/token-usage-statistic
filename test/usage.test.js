import assert from 'node:assert/strict'
import test from 'node:test'

import {
  addTotals,
  cloneTotals,
  count,
  emptyTotals,
  localDayKey,
  makeRecord,
  normalizeUsage,
  recordKey,
  sanitizeRecord,
  totalsOfUsage,
} from '../src/host/usage.js'

test('count keeps only usable non-negative numbers', () => {
  assert.equal(count(12), 12)
  assert.equal(count(12.4), 12)
  assert.equal(count(-1), 0)
  assert.equal(count(Number.NaN), 0)
  assert.equal(count(null), 0)
  assert.equal(count('30'), 30)
  assert.equal(count(undefined), 0)
})

test('emptyTotals is a fresh zeroed block', () => {
  const first = emptyTotals()
  const second = emptyTotals()
  first.calls = 3
  assert.equal(second.calls, 0)
  assert.deepEqual(Object.values(second), [0, 0, 0, 0, 0, 0, 0])
})

test('normalizeUsage defaults missing counters and derives the total', () => {
  assert.deepEqual(normalizeUsage({ inputTokens: 100, outputTokens: 20 }), {
    input: 100,
    output: 20,
    cacheRead: 0,
    cacheWrite: 0,
    reasoning: 0,
    total: 120,
  })
})

test('normalizeUsage trusts a reported total when present', () => {
  assert.equal(normalizeUsage({ inputTokens: 100, outputTokens: 20, totalTokens: 999 }).total, 999)
})

test('normalizeUsage ignores cache counters in the derived total', () => {
  const normalized = normalizeUsage({ inputTokens: 100, outputTokens: 20, cacheReadTokens: 80 })
  assert.equal(normalized.total, 120)
  assert.equal(normalized.cacheRead, 80)
})

test('totalsOfUsage counts exactly one call', () => {
  const totals = totalsOfUsage({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 3 })
  assert.equal(totals.calls, 1)
  assert.equal(totals.inputTokens, 10)
  assert.equal(totals.outputTokens, 5)
  assert.equal(totals.cacheReadTokens, 3)
  assert.equal(totals.totalTokens, 15)
})

test('addTotals accumulates and returns the destination', () => {
  const into = emptyTotals()
  const result = addTotals(into, totalsOfUsage({ inputTokens: 10, outputTokens: 5 }))
  assert.equal(result, into)
  addTotals(into, totalsOfUsage({ inputTokens: 1, outputTokens: 2 }))
  assert.equal(into.calls, 2)
  assert.equal(into.inputTokens, 11)
  assert.equal(into.outputTokens, 7)
  assert.equal(into.totalTokens, 18)
})

test('cloneTotals detaches the copy', () => {
  const source = { ...emptyTotals(), calls: 2, inputTokens: 10, totalTokens: 10 }
  const copy = cloneTotals(source)
  assert.notEqual(copy, source)
  copy.calls = 9
  assert.equal(source.calls, 2)
})

test('localDayKey uses the local calendar day', () => {
  const lateEvening = new Date(2026, 9, 31, 23, 30, 0).getTime()
  assert.equal(localDayKey(lateEvening), '2026-10-31')
})

test('recordKey prefers session and seq, then falls back to time', () => {
  assert.equal(recordKey({ sessionId: 's', seq: 4 }), 's#4')
  assert.equal(recordKey({ sessionId: 's', time: 99 }), 's#t99')
})

test('sanitizeRecord rejects records without a session or usage', () => {
  assert.equal(sanitizeRecord(null), null)
  assert.equal(sanitizeRecord({}), null)
  assert.equal(sanitizeRecord({ sessionId: 's' }), null)
  assert.equal(sanitizeRecord({ sessionId: 's', usage: {} }), null)
})

test('sanitizeRecord normalizes an untrusted ledger line', () => {
  const record = sanitizeRecord({
    sessionId: 's',
    time: 1788454310462,
    provider: '',
    model: 'x',
    usage: { inputTokens: '10', outputTokens: 5.6, cacheReadTokens: -2 },
  })
  assert.notEqual(record, null)
  assert.equal(record.provider, 'unknown')
  assert.equal(record.model, 'x')
  assert.equal(record.usage.inputTokens, 10)
  assert.equal(record.usage.outputTokens, 6)
  assert.equal(record.usage.cacheReadTokens, 0)
  assert.equal(record.usage.totalTokens, 16)
  assert.match(record.day, /^\d{4}-\d{2}-\d{2}$/)
})

test('makeRecord returns null for a usage report without tokens', () => {
  assert.equal(
    makeRecord({ time: Date.now(), sessionId: 's', provider: 'p', model: 'm', usage: { inputTokens: 0, outputTokens: 0 } }),
    null,
  )
})

test('makeRecord carries identity and the canonical usage block', () => {
  const record = makeRecord({
    time: Date.now(),
    sessionId: 's',
    seq: 7,
    provider: 'deepseek',
    model: 'flash',
    usage: { inputTokens: 10, outputTokens: 2, cacheReadTokens: 4 },
  })
  assert.equal(record.sessionId, 's')
  assert.equal(record.seq, 7)
  assert.equal(record.provider, 'deepseek')
  assert.equal(record.model, 'flash')
  assert.equal(record.usage.totalTokens, 12)
})
