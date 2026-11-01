import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { prefetchRanges, prefetchToday, readCache, writeCache } from '../src/client/cache.js'

class MemoryStorage {
  private readonly map = new Map<string, string>()

  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }

  clear(): void {
    this.map.clear()
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null
  }

  get length(): number {
    return this.map.size
  }
}

let originalStorage: Storage | undefined
let originalFetch: typeof fetch | undefined

beforeEach(() => {
  originalStorage = globalThis.localStorage
  originalFetch = globalThis.fetch
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true })
})

afterEach(() => {
  if (originalStorage === undefined) delete (globalThis as { localStorage?: Storage }).localStorage
  else Object.defineProperty(globalThis, 'localStorage', { value: originalStorage, configurable: true })
  if (originalFetch === undefined) delete (globalThis as { fetch?: typeof fetch }).fetch
  else globalThis.fetch = originalFetch
})

describe('snapshot cache', () => {
  it('round-trips a snapshot', () => {
    writeCache('summary:1', { tokens: 42 })
    expect(readCache<{ tokens: number }>('summary:1')).toEqual({ tokens: 42 })
  })

  it('ignores an expired entry', () => {
    writeCache('summary:1', { tokens: 42 })
    const storage = globalThis.localStorage
    const key = storage.key(0)
    expect(key).not.toBeNull()
    const entry = JSON.parse(storage.getItem(key as string) as string) as { at: number; data: unknown }
    entry.at = Date.now() - 31 * 60 * 1000
    storage.setItem(key as string, JSON.stringify(entry))
    expect(readCache('summary:1')).toBeNull()
  })

  it('prefetches today into both caches', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      return {
        ok: true,
        async json() {
          return url.includes('summary') ? { schemaVersion: 2, kind: 'summary' } : { schemaVersion: 2, kind: 'daily' }
        },
      }
    }) as unknown as typeof fetch

    prefetchToday()
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(readCache('summary:1')).toEqual({ schemaVersion: 2, kind: 'summary' })
    expect(readCache('daily:1')).toEqual({ schemaVersion: 2, kind: 'daily' })
  })

  it('prefetches the 7 and 30 day windows', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      return {
        ok: true,
        async json() {
          return url.includes('summary') ? { schemaVersion: 2, kind: 'summary' } : { schemaVersion: 2, kind: 'daily' }
        },
      }
    }) as unknown as typeof fetch

    prefetchRanges()
    await new Promise((resolve) => setTimeout(resolve, 20))

    for (const days of [7, 30]) {
      expect(readCache(`summary:${days}`)).toEqual({ schemaVersion: 2, kind: 'summary' })
      expect(readCache(`daily:${days}`)).toEqual({ schemaVersion: 2, kind: 'daily' })
    }
  })
})
