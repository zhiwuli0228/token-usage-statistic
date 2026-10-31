import { describe, expect, it } from 'vitest'

import {
  bucketsOf,
  cacheHitRate,
  count,
  dayKey,
  makeSample,
  routeOf,
  sampleDraftOf,
  sanitizeSample,
  totalTokens,
} from '../src/host/usage.js'
import { makeSample as sample } from './helpers.js'

describe('token primitives', () => {
  it('normalizes untrusted counts', () => {
    expect(count(12)).toBe(12)
    expect(count(12.6)).toBe(13)
    expect(count(-1)).toBe(0)
    expect(count(Number.NaN)).toBe(0)
    expect(count('30')).toBe(30)
    expect(count(null)).toBe(0)
  })

  it('uses the local calendar day', () => {
    expect(dayKey(new Date(2026, 9, 31, 23, 30).getTime())).toBe('2026-10-31')
  })

  it('reads buckets and totals cache separately from input', () => {
    expect(bucketsOf({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 90, cacheWriteTokens: 1 })).toEqual({
      input: 10,
      output: 5,
      cacheRead: 90,
      cacheWrite: 1,
    })
    expect(totalTokens({ input: 10, output: 5, cacheRead: 90, cacheWrite: 1 })).toBe(106)
  })

  it('computes the prompt-side cache hit rate', () => {
    expect(cacheHitRate({ input: 10, output: 5, cacheRead: 90, cacheWrite: 0 })).toBe(90)
    expect(cacheHitRate({ input: 0, output: 5, cacheRead: 0, cacheWrite: 0 })).toBeNull()
  })
})

describe('event sampling', () => {
  it('reads usage from a committed assistant message', () => {
    const draft = sampleDraftOf({
      type: 'assistant/message',
      seq: 4,
      time: 1,
      data: { turn: 2, step: 1, usage: { inputTokens: 10, outputTokens: 2 } },
    })
    expect(draft).toMatchObject({ key: '2:1', kind: 'assistant' })
  })

  it('reads a live usage chunk and shares the message sample key', () => {
    const draft = sampleDraftOf({
      type: 'assistant/chunk',
      seq: 3,
      time: 1,
      data: { turn: 2, step: 1, chunk: { type: 'usage', usage: { inputTokens: 10, outputTokens: 1 } } },
    })
    expect(draft).toMatchObject({ key: '2:1', kind: 'assistant' })
  })

  it('keys compaction summaries separately', () => {
    const draft = sampleDraftOf({
      type: 'compaction/summary',
      seq: 9,
      time: 1,
      data: { compactionId: 'cmp-1', usage: { inputTokens: 10, outputTokens: 1 } },
    })
    expect(draft).toMatchObject({ key: 'compaction:cmp-1', kind: 'compaction' })
  })

  it('ignores events without usage or unknown types', () => {
    expect(sampleDraftOf({ type: 'assistant/message', seq: 1, time: 1, data: {} })).toBeNull()
    expect(sampleDraftOf({ type: 'assistant/chunk', seq: 1, time: 1, data: { chunk: { type: 'text-delta' } } })).toBeNull()
    expect(sampleDraftOf({ type: 'tool/result', seq: 1, time: 1, data: {} })).toBeNull()
    expect(sampleDraftOf(undefined)).toBeNull()
  })

  it('attributes the message source before the header', () => {
    expect(
      routeOf({ type: 'assistant/message', seq: 1, time: 1, data: { message: { source: { provider: 'p', model: 'm' } }, header: { config: { provider: 'h', model: 'hm' } } } }),
    ).toEqual({ provider: 'p', model: 'm' })
    expect(
      routeOf({ type: 'request/header', seq: 1, time: 1, data: { header: { config: { provider: 'h', model: 'hm' } } } }),
    ).toEqual({ provider: 'h', model: 'hm' })
  })

  it('builds a canonical sample and rejects a tokenless report', () => {
    const built = makeSample({
      sessionId: 's',
      seq: 2,
      time: Date.now(),
      key: '1:1',
      kind: 'assistant',
      provider: 'p',
      model: 'm',
      usage: { inputTokens: 10, outputTokens: 5 },
    })
    expect(built).toMatchObject({ version: 2, sampleKey: '1:1', provider: 'p', model: 'm' })
    expect(built?.buckets).toEqual({ input: 10, output: 5, cacheRead: 0, cacheWrite: 0 })

    expect(
      makeSample({ sessionId: 's', seq: 2, time: Date.now(), key: '1:1', kind: 'assistant', provider: 'p', model: 'm', usage: {} }),
    ).toBeNull()
  })

  it('migrates a v1 ledger line into a unique assistant sample', () => {
    const migrated = sanitizeSample({
      version: 1,
      sessionId: 's',
      seq: 7,
      time: Date.now(),
      day: '2026-10-31',
      provider: 'deepseek',
      model: 'deepseek-flash',
      usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 5, cacheWriteTokens: 0, totalTokens: 125 },
    })
    expect(migrated).toMatchObject({ version: 2, sampleKey: 'assistant:7', kind: 'assistant' })
    expect(migrated?.buckets).toEqual({ input: 100, output: 20, cacheRead: 5, cacheWrite: 0 })
  })

  it('rejects malformed samples', () => {
    expect(sanitizeSample(null)).toBeNull()
    expect(sanitizeSample({})).toBeNull()
    expect(sanitizeSample({ sessionId: 's', seq: 1 })).toBeNull()
    expect(sanitizeSample({ ...sample(), buckets: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } })).toBeNull()
  })
})
