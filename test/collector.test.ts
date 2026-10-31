import { describe, expect, it } from 'vitest'

import { Collector } from '../src/host/collector.js'

const session = { id: 'session-1' }

function message(overrides: Record<string, unknown> = {}) {
  return {
    type: 'assistant/message',
    seq: 5,
    time: Date.now(),
    data: { turn: 1, step: 1, usage: { inputTokens: 10, outputTokens: 4 }, ...overrides },
  }
}

describe('collector', () => {
  it('ignores events that carry no usage', () => {
    const collector = new Collector()
    expect(collector.observe(session, { type: 'user/message', seq: 1, time: 1, data: {} })).toBeNull()
    expect(collector.observe(session, { type: 'assistant/message', seq: 2, time: 1, data: { usage: undefined } })).toBeNull()
    expect(collector.observe(undefined, message())).toBeNull()
  })

  it('attributes usage from the message source', () => {
    const collector = new Collector()
    const collected = collector.observe(session, message({ message: { source: { provider: 'deepseek-account', model: 'deepseek-flash' } } }))
    expect(collected?.sample).toMatchObject({ provider: 'deepseek-account', model: 'deepseek-flash', sampleKey: '1:1' })
  })

  it('falls back to the remembered request header', () => {
    const collector = new Collector()
    collector.observe(session, {
      type: 'request/header',
      seq: 1,
      time: 1,
      data: { header: { config: { provider: 'gateway', model: 'pro' } }, reason: 'initial' },
    })
    const collected = collector.observe(session, message())
    expect(collected?.sample).toMatchObject({ provider: 'gateway', model: 'pro' })
  })

  it('prefers the message source over the remembered header', () => {
    const collector = new Collector()
    collector.observe(session, { type: 'request/header', seq: 1, time: 1, data: { header: { config: { provider: 'gateway', model: 'pro' } } } })
    const collected = collector.observe(session, message({ message: { source: { provider: 'direct', model: 'flash' } } }))
    expect(collected?.sample).toMatchObject({ provider: 'direct', model: 'flash' })
  })

  it('samples a live usage chunk with the remembered route', () => {
    const collector = new Collector()
    collector.observe(session, { type: 'request/header', seq: 1, time: 1, data: { header: { config: { provider: 'p', model: 'm' } } } })
    const collected = collector.observe(session, {
      type: 'assistant/chunk',
      seq: 4,
      time: 2,
      data: { turn: 1, step: 1, chunk: { type: 'usage', usage: { inputTokens: 7, outputTokens: 1 } } },
    })
    expect(collected?.sample).toMatchObject({ provider: 'p', model: 'm', sampleKey: '1:1', kind: 'assistant' })
  })

  it('samples a compaction summary under its own key', () => {
    const collector = new Collector()
    const collected = collector.observe(session, {
      type: 'compaction/summary',
      seq: 8,
      time: 3,
      data: { compactionId: 'cmp-9', provider: 'deepseek', model: 'deepseek-v4-pro', usage: { inputTokens: 30, outputTokens: 2 } },
    })
    expect(collected?.sample).toMatchObject({ sampleKey: 'compaction:cmp-9', kind: 'compaction', model: 'deepseek-v4-pro' })
  })

  it('marks unknown attribution explicitly', () => {
    const collector = new Collector()
    expect(collector.observe(session, message())?.sample).toMatchObject({ provider: 'unknown', model: 'unknown' })
  })

  it('forgets one session without touching another', () => {
    const collector = new Collector()
    collector.observe({ id: 'a' }, { type: 'request/header', seq: 1, time: 1, data: { header: { config: { provider: 'pa', model: 'ma' } } } })
    collector.observe({ id: 'b' }, { type: 'request/header', seq: 1, time: 1, data: { header: { config: { provider: 'pb', model: 'mb' } } } })
    collector.forget('a')
    expect(collector.observe({ id: 'a' }, message())?.sample).toMatchObject({ provider: 'unknown' })
    expect(collector.observe({ id: 'b' }, message())?.sample).toMatchObject({ provider: 'pb' })
  })

  it('bounds the remembered-route table', () => {
    const collector = new Collector({ maxSessions: 2 })
    for (const id of ['a', 'b', 'c']) {
      collector.observe({ id }, { type: 'request/header', seq: 1, time: 1, data: { header: { config: { provider: id, model: id } } } })
    }
    expect(collector.observe({ id: 'a' }, message())?.sample).toMatchObject({ provider: 'unknown' })
    expect(collector.observe({ id: 'c' }, message())?.sample).toMatchObject({ provider: 'c' })
  })
})
