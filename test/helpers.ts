import type { UsageSample } from '../src/host/types.js'

/** Build one canonical v2 sample for tests. */
export function makeSample(overrides: Partial<UsageSample> = {}): UsageSample {
  const time = overrides.time ?? Date.now()
  return {
    version: 2,
    sessionId: overrides.sessionId ?? 'session-test',
    seq: overrides.seq ?? 1,
    time,
    day: overrides.day ?? dayOf(time),
    sampleKey: overrides.sampleKey ?? '1:1',
    kind: overrides.kind ?? 'assistant',
    provider: overrides.provider ?? 'deepseek',
    model: overrides.model ?? 'deepseek-v4-flash',
    buckets: {
      input: 1000,
      output: 250,
      cacheRead: 400,
      cacheWrite: 0,
      ...overrides.buckets,
    },
  }
}

/** Local calendar key, mirroring the Host's day key without importing it. */
export function dayOf(time: number): string {
  const date = new Date(time)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
