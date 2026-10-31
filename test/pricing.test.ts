import { describe, expect, it } from 'vitest'

import { createPricer, DEFAULT_MODEL_ALIASES } from '../src/host/pricing.js'
import { makeSample } from './helpers.js'

const pricer = createPricer()

function pricedAt(time: number, overrides: Parameters<typeof makeSample>[0] = {}) {
  return pricer.estimate(makeSample({ time, ...overrides }))
}

describe('pricing catalog', () => {
  it('prices the flat window before the time-band schedule', () => {
    const result = pricedAt(Date.parse('2026-08-10T02:00:00Z'), { buckets: { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } })
    expect(result.counted).toBe(true)
    expect(result).toMatchObject({ amount: 0.14, currency: 'USD', ruleId: 'deepseek-v4-flash-usd-flat-before-2026-08-16' })
  })

  it('prices a peak window on a weekday', () => {
    const result = pricedAt(Date.parse('2026-09-01T02:00:00Z'), { buckets: { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } })
    expect(result).toMatchObject({ amount: 0.44, currency: 'USD', ruleId: 'deepseek-v4-flash-usd-weekday-schedule' })
  })

  it('prices off-peak hours', () => {
    const result = pricedAt(Date.parse('2026-09-01T13:00:00Z'), { buckets: { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } })
    expect(result).toMatchObject({ amount: 0.22, currency: 'USD' })
  })

  it('prices weekends as off-peak', () => {
    const result = pricedAt(Date.parse('2026-09-06T02:00:00Z'), { buckets: { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } })
    expect(result).toMatchObject({ amount: 0.22, currency: 'USD' })
  })

  it('prices output tokens with their own unit price', () => {
    const result = pricedAt(Date.parse('2026-09-01T02:00:00Z'), { buckets: { input: 0, output: 1_000_000, cacheRead: 0, cacheWrite: 0 } })
    expect(result).toMatchObject({ amount: 1.32 })
  })

  it('prices cache reads and leaves cache writes unpriced', () => {
    expect(pricedAt(Date.parse('2026-09-01T02:00:00Z'), { buckets: { input: 0, output: 0, cacheRead: 1_000_000, cacheWrite: 0 } })).toMatchObject({ amount: 0.014 })
    expect(pricedAt(Date.parse('2026-09-01T02:00:00Z'), { buckets: { input: 0, output: 0, cacheRead: 0, cacheWrite: 1_000_000 } })).toMatchObject({ counted: true, complete: false })
  })

  it('maps the account-route model ids onto the published catalog', () => {
    expect(DEFAULT_MODEL_ALIASES['deepseek-flash']).toBe('deepseek-v4-flash')
    const result = pricedAt(Date.parse('2026-09-01T02:00:00Z'), {
      provider: 'deepseek-account',
      model: 'deepseek-flash',
      buckets: { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 },
    })
    expect(result).toMatchObject({ amount: 0.44, currency: 'USD' })
  })

  it('fails closed for an unknown route, model or timestamp', () => {
    expect(pricedAt(Date.now(), { provider: 'openrouter' })).toMatchObject({ counted: true, complete: false })
    expect(pricedAt(Date.now(), { model: 'some-unlisted-model' })).toMatchObject({ counted: true, complete: false })
  })

  it('does not count a zero-token report', () => {
    const result = pricedAt(Date.now(), { buckets: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } })
    expect(result.counted).toBe(false)
  })
})

describe('pricer options', () => {
  it('accepts a custom alias', () => {
    const custom = createPricer({ aliases: { 'my-flash': 'deepseek-v4-flash' } })
    const result = custom.estimate(
      makeSample({
        time: Date.parse('2026-09-01T02:00:00Z'),
        model: 'my-flash',
        buckets: { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 },
      }),
    )
    expect(result).toMatchObject({ amount: 0.44 })
  })

  it('accepts an extra route as priced', () => {
    const custom = createPricer({ providers: ['deepseek', 'my-gateway'] })
    const result = custom.estimate(
      makeSample({
        time: Date.parse('2026-09-01T02:00:00Z'),
        provider: 'my-gateway',
        buckets: { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 },
      }),
    )
    expect(result).toMatchObject({ amount: 0.44 })
  })

  it('ignores an invalid custom catalog with a warning', () => {
    const warnings: string[] = []
    const custom = createPricer({ rules: [{ id: 'broken' } as never] }, (message) => warnings.push(message))
    expect(warnings.length).toBe(1)
    expect(custom.estimate(makeSample({ time: Date.parse('2026-09-01T02:00:00Z') })).counted).toBe(true)
  })
})
