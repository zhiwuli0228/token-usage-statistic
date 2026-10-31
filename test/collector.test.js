import assert from 'node:assert/strict'
import test from 'node:test'

import { Collector } from '../src/host/collector.js'

const session = { id: 'session-1' }

function messageEvent(usage, source, seq = 1) {
  return {
    type: 'assistant/message',
    seq,
    time: Date.now(),
    data: { turn: 1, step: 1, message: { role: 'assistant', source }, stream: [], usage },
  }
}

test('ignores events that are not committed assistant messages', () => {
  const collector = new Collector()
  assert.equal(collector.observe(session, { type: 'user/message', seq: 1, data: {} }), null)
  assert.equal(collector.observe(session, { type: 'tool/result', seq: 2, data: {} }), null)
  assert.equal(collector.observe(undefined, messageEvent({ inputTokens: 1, outputTokens: 1 }, { provider: 'p', model: 'm' })), null)
})

test('ignores committed messages without usage', () => {
  const collector = new Collector()
  assert.equal(collector.observe(session, messageEvent(undefined, { provider: 'p', model: 'm' })), null)
})

test('attributes usage from the message source', () => {
  const collector = new Collector()
  const record = collector.observe(
    session,
    messageEvent({ inputTokens: 10, outputTokens: 4 }, { kind: 'model', provider: 'deepseek', model: 'flash' }),
  )
  assert.equal(record.provider, 'deepseek')
  assert.equal(record.model, 'flash')
  assert.equal(record.usage.inputTokens, 10)
  assert.equal(record.usage.totalTokens, 14)
})

test('falls back to the remembered request header', () => {
  const collector = new Collector()
  collector.observe(session, {
    type: 'request/header',
    seq: 1,
    time: Date.now(),
    data: { header: { config: { provider: 'gateway', model: 'pro' } }, reason: 'initial' },
  })
  const record = collector.observe(session, messageEvent({ inputTokens: 5, outputTokens: 5 }, undefined))
  assert.equal(record.provider, 'gateway')
  assert.equal(record.model, 'pro')
})

test('the message source wins over the remembered header', () => {
  const collector = new Collector()
  collector.observe(session, {
    type: 'request/header',
    seq: 1,
    data: { header: { config: { provider: 'gateway', model: 'pro' } } },
  })
  const record = collector.observe(session, messageEvent({ inputTokens: 1, outputTokens: 1 }, { provider: 'direct', model: 'flash' }))
  assert.equal(record.provider, 'direct')
  assert.equal(record.model, 'flash')
})

test('unknown attribution is explicit rather than guessed', () => {
  const collector = new Collector()
  const record = collector.observe(session, messageEvent({ inputTokens: 1, outputTokens: 1 }, undefined))
  assert.equal(record.provider, 'unknown')
  assert.equal(record.model, 'unknown')
})

test('headers are per session and forgettable', () => {
  const collector = new Collector()
  collector.observe({ id: 'a' }, { type: 'request/header', seq: 1, data: { header: { config: { provider: 'pa', model: 'ma' } } } })
  collector.observe({ id: 'b' }, { type: 'request/header', seq: 1, data: { header: { config: { provider: 'pb', model: 'mb' } } } })

  assert.equal(collector.observe({ id: 'a' }, messageEvent({ inputTokens: 1, outputTokens: 1 }, undefined)).provider, 'pa')
  collector.forget('a')
  assert.equal(collector.observe({ id: 'a' }, messageEvent({ inputTokens: 1, outputTokens: 1 }, undefined, 2)).provider, 'unknown')
  assert.equal(collector.observe({ id: 'b' }, messageEvent({ inputTokens: 1, outputTokens: 1 }, undefined, 2)).provider, 'pb')
})

test('the header fallback table is bounded', () => {
  const collector = new Collector({ maxHeaders: 2 })
  for (const id of ['a', 'b', 'c']) {
    collector.observe({ id }, { type: 'request/header', seq: 1, data: { header: { config: { provider: id, model: id } } } })
  }
  assert.equal(collector.headers.size, 2)
  assert.equal(collector.headers.has('a'), false)
  assert.equal(collector.headers.has('c'), true)
})

test('a usage report without tokens produces no record', () => {
  const collector = new Collector()
  assert.equal(collector.observe(session, messageEvent({ inputTokens: 0, outputTokens: 0 }, { provider: 'p', model: 'm' })), null)
})
