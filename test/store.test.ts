import { describe, expect, it } from 'vitest'

import type { Pricer } from '../src/host/pricing.js'
import { UsageStore } from '../src/host/store.js'
import type { UsageSample } from '../src/host/types.js'
import { makeSample } from './helpers.js'

function fakePricer(amountOf: (sample: UsageSample) => number | null = () => 0.5): Pricer {
  return {
    estimate(sample) {
      const amount = amountOf(sample)
      return amount === null
        ? { counted: true, complete: false }
        : { counted: true, complete: true, amount, currency: 'USD', ruleId: 'test-rule' }
    },
    rules: [],
    catalogUpdatedAt: '2026-01-01T00:00:00.000Z',
  }
}

const proportional = (sample: UsageSample): number => (sample.buckets.input + sample.buckets.output) / 1_000_000

describe('usage fold', () => {
  it('starts empty and reports every view', () => {
    const store = new UsageStore({ pricer: fakePricer() })
    const snapshot = store.snapshot({ days: 30 })
    expect(snapshot.totals.calls).toBe(0)
    expect(snapshot.totals.tokens).toBe(0)
    expect(snapshot.totals.cost).toMatchObject({ amount: 0, complete: true })
    expect(snapshot.byProvider).toEqual([])
    expect(snapshot.byDay).toEqual([])
    expect(snapshot.sessions).toEqual([])
  })

  it('folds a sample into totals, provider, model, day and session', () => {
    const store = new UsageStore({ pricer: fakePricer(proportional) })
    const time = Date.now()
    expect(store.apply(makeSample({ time, seq: 1, sampleKey: '1:1' }))).toBe(true)

    const snapshot = store.snapshot({ days: 1, now: time })
    expect(snapshot.totals).toMatchObject({ calls: 1, input: 1000, output: 250, cacheRead: 400, tokens: 1650 })
    expect(snapshot.totals.cost).toMatchObject({ amount: 0.00125, currency: 'USD', complete: true })
    expect(snapshot.byProvider).toHaveLength(1)
    expect(snapshot.byProvider[0]).toMatchObject({ provider: 'deepseek', calls: 1, tokens: 1650 })
    expect(snapshot.byProvider[0]?.models[0]).toMatchObject({ model: 'deepseek-v4-flash', tokens: 1650 })
    expect(snapshot.byDay[0]).toMatchObject({ calls: 1, tokens: 1650 })
    expect(snapshot.sessions[0]).toMatchObject({ sessionId: 'session-test', calls: 1 })
    expect(snapshot.counts.samples).toBe(1)
  })

  it('replaces a re-reported step instead of double counting it', () => {
    const store = new UsageStore({ pricer: fakePricer(proportional) })
    const time = Date.now()
    store.apply(makeSample({ time, seq: 3, sampleKey: '1:1', buckets: { input: 1000, output: 10, cacheRead: 0, cacheWrite: 0 } }))
    store.apply(makeSample({ time: time + 10, seq: 4, sampleKey: '1:1', buckets: { input: 1000, output: 500, cacheRead: 0, cacheWrite: 0 } }))

    const snapshot = store.snapshot({ days: 1, now: time })
    expect(snapshot.totals.calls).toBe(1)
    expect(snapshot.totals.output).toBe(500)
    expect(snapshot.totals.cost.amount).toBeCloseTo(0.0015, 6)
    expect(snapshot.byDay).toHaveLength(1)
    expect(snapshot.counts.samples).toBe(1)
  })

  it('ignores an older report that arrives after a newer one', () => {
    const store = new UsageStore({ pricer: fakePricer() })
    const time = Date.now()
    store.apply(makeSample({ time, seq: 10, sampleKey: '2:1', buckets: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0 } }))
    expect(store.apply(makeSample({ time, seq: 9, sampleKey: '2:1', buckets: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 } }))).toBe(false)
    expect(store.snapshot({ days: 1, now: time }).totals.output).toBe(50)
  })

  it('deduplicates the exact same report', () => {
    const store = new UsageStore({ pricer: fakePricer() })
    const sample = makeSample({ time: Date.now(), seq: 5, sampleKey: '3:1' })
    expect(store.apply(sample)).toBe(true)
    expect(store.apply({ ...sample })).toBe(false)
    expect(store.snapshot({ days: 1 }).totals.calls).toBe(1)
  })

  it('treats compaction and assistant samples as distinct calls', () => {
    const store = new UsageStore({ pricer: fakePricer() })
    const time = Date.now()
    store.apply(makeSample({ time, seq: 1, sampleKey: '1:1', kind: 'assistant' }))
    store.apply(makeSample({ time, seq: 2, sampleKey: 'compaction:c1', kind: 'compaction' }))
    expect(store.snapshot({ days: 1, now: time }).totals.calls).toBe(2)
  })

  it('filters by trailing days', () => {
    const store = new UsageStore({ pricer: fakePricer() })
    const now = Date.now()
    store.apply(makeSample({ time: now - 30 * 86400_000, seq: 1, sampleKey: 'assistant:1' }))
    store.apply(makeSample({ time: now, seq: 2, sampleKey: 'assistant:2' }))
    expect(store.snapshot({ days: 7, now }).totals.calls).toBe(1)
    expect(store.snapshot({ days: null, now }).totals.calls).toBe(2)
  })

  it('ranks sessions and models by tokens and honors limits', () => {
    const store = new UsageStore({ pricer: fakePricer() })
    const time = Date.now()
    store.apply(makeSample({ time, sessionId: 'small', seq: 1, sampleKey: 'a', buckets: { input: 10, output: 0, cacheRead: 0, cacheWrite: 0 } }))
    store.apply(makeSample({ time, sessionId: 'big', seq: 1, sampleKey: 'a', buckets: { input: 1000, output: 0, cacheRead: 0, cacheWrite: 0 } }))
    store.apply(makeSample({ time, sessionId: 'big', seq: 2, sampleKey: 'b', provider: 'other', model: 'second', buckets: { input: 500, output: 0, cacheRead: 0, cacheWrite: 0 } }))

    const snapshot = store.snapshot({ days: 1, now: time, sessionLimit: 1 })
    expect(snapshot.sessions).toHaveLength(1)
    expect(snapshot.sessions[0]?.sessionId).toBe('big')
    expect(snapshot.byProvider.map((entry) => entry.provider)).toEqual(['deepseek', 'other'])
    expect(snapshot.byProvider[0]?.models[0]?.tokens).toBe(1010)
  })

  it('keeps unpriced calls visible', () => {
    const store = new UsageStore({ pricer: fakePricer(() => null) })
    store.apply(makeSample({ time: Date.now(), seq: 1, sampleKey: '1:1' }))
    const snapshot = store.snapshot({ days: 1 })
    expect(snapshot.totals.cost).toMatchObject({ amount: null, complete: false, unpricedCalls: 1 })
    expect(snapshot.counts.unpriced).toBe(1)
  })

  it('tracks the highest seq per session for incremental scans', () => {
    const store = new UsageStore({ pricer: fakePricer() })
    store.apply(makeSample({ sessionId: 's1', seq: 4, sampleKey: '1:1' }))
    store.apply(makeSample({ sessionId: 's1', seq: 9, sampleKey: '2:1' }))
    store.apply(makeSample({ sessionId: 's2', seq: 2, sampleKey: '1:1' }))
    expect(store.lastSeq('s1')).toBe(9)
    expect(store.lastSeq('s2')).toBe(2)
    expect(store.lastSeq('missing')).toBe(-1)
  })

  it('produces daily drill-downs with per-day sessions and models', () => {
    const store = new UsageStore({ pricer: fakePricer(proportional) })
    const now = Date.now()
    store.apply(makeSample({ time: now, sessionId: 's1', seq: 1, sampleKey: '1:1' }))
    store.apply(
      makeSample({
        time: now,
        sessionId: 's2',
        seq: 1,
        sampleKey: '1:1',
        provider: 'other',
        model: 'other-model',
        buckets: { input: 500, output: 100, cacheRead: 0, cacheWrite: 0 },
      }),
    )

    const details = store.dailyDetails({ days: 1, now })
    expect(details.days).toHaveLength(1)
    expect(details.days[0].calls).toBe(2)
    expect(details.days[0].sessions).toHaveLength(2)
    expect(details.days[0].models).toHaveLength(2)
    expect(details.days[0].sessions[0].sessionId).toBe('s1')
  })

  it('produces a JSON-safe snapshot detached from the fold', () => {
    const store = new UsageStore({ pricer: fakePricer() })
    store.apply(makeSample({ time: Date.now() }))
    const snapshot = store.snapshot({ days: 1 })
    const parsed = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot
    expect(parsed.totals.calls).toBe(1)
    snapshot.totals.calls = 99
    expect(store.snapshot({ days: 1 }).totals.calls).toBe(1)
  })
})
