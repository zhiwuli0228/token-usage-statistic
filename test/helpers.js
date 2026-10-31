/**
 * Shared fixtures for the unit tests.
 */

/**
 * Build one canonical usage record.
 *
 * @param {{ sessionId?: string, seq?: number, time?: number, provider?: string, model?: string, usage?: Record<string, number> }} [overrides] - field overrides.
 * @returns {Record<string, any>} canonical record.
 */
export function testRecord(overrides = {}) {
  const time = overrides.time ?? Date.now()
  return {
    version: 1,
    time,
    day: dayKey(time),
    sessionId: overrides.sessionId ?? 'session-test',
    seq: overrides.seq ?? 1,
    provider: overrides.provider ?? 'deepseek',
    model: overrides.model ?? 'deepseek-chat',
    usage: {
      inputTokens: 1000,
      outputTokens: 250,
      cacheReadTokens: 400,
      cacheWriteTokens: 0,
      reasoningTokens: 50,
      totalTokens: 1250,
      ...overrides.usage,
    },
  }
}

/**
 * The same local-day spelling the plugin uses, kept independent for fixtures.
 *
 * @param {number} time - epoch milliseconds.
 * @returns {string} `YYYY-MM-DD`.
 */
export function dayKey(time) {
  const date = new Date(time)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
