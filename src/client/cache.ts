/**
 * Small client-side snapshot cache.
 *
 * The panel is opened repeatedly during a session. Keeping the last snapshot
 * for a range lets the first paint show real numbers while the fresh request
 * runs in the background, instead of a full-page loading state.
 */

const PREFIX = 'token-usage-statistic:cache:v3:'
const TTL_MS = 30 * 60 * 1000

export const SUMMARY_URL = '/token-usage-statistic/api/summary'
export const DAILY_URL = '/token-usage-statistic/api/daily'

interface CacheEntry<T> {
  at: number
  data: T
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Read a fresh cache entry, or null when missing/expired/unreadable. */
export function readCache<T>(key: string): T | null {
  const target = storage()
  if (target === null) return null
  try {
    const raw = target.getItem(PREFIX + key)
    if (raw === null) return null
    const entry = JSON.parse(raw) as CacheEntry<T>
    if (typeof entry.at !== 'number' || Date.now() - entry.at > TTL_MS) return null
    return entry.data
  } catch {
    return null
  }
}

/** Write a cache entry; quota or private-mode failures are ignored. */
export function writeCache<T>(key: string, data: T): void {
  const target = storage()
  if (target === null) return
  try {
    target.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), data }))
  } catch {
    /* ignore quota / disabled storage */
  }
}

/**
 * Warm the today cache as soon as the client module activates.
 *
 * This runs before the sidebar panel is opened, so the first render usually
 * finds a fresh `summary:1` snapshot instead of starting from scratch.
 */
export function prefetchToday(): void {
  if (typeof fetch !== 'function') return
  if (readCache('summary:1') !== null && readCache('daily:1') !== null) return
  void (async () => {
    try {
      const [summary, daily] = await Promise.all([
        fetch(`${SUMMARY_URL}?days=1&recent=20`, { cache: 'no-store' }),
        fetch(`${DAILY_URL}?days=1`, { cache: 'no-store' }),
      ])
      if (summary.ok) writeCache('summary:1', await summary.json())
      if (daily.ok) writeCache('daily:1', await daily.json())
    } catch {
      /* prefetch is best-effort */
    }
  })()
}

const RANGE_PREFETCH = [7, 30] as const
let prefetchingRanges = false

/**
 * Warm the wider windows after the panel is open.
 *
 * Runs at most once at a time and only fills missing entries, so opening the
 * plugin page does not create a burst of duplicate requests.
 */
export function prefetchRanges(): void {
  if (typeof fetch !== 'function' || prefetchingRanges) return
  prefetchingRanges = true
  void (async () => {
    try {
      for (const days of RANGE_PREFETCH) {
        if (readCache(`summary:${days}`) === null) {
          const response = await fetch(`${SUMMARY_URL}?days=${days}&recent=20`, { cache: 'no-store' })
          if (response.ok) writeCache(`summary:${days}`, await response.json())
        }
        if (readCache(`daily:${days}`) === null) {
          const response = await fetch(`${DAILY_URL}?days=${days}`, { cache: 'no-store' })
          if (response.ok) writeCache(`daily:${days}`, await response.json())
        }
      }
    } catch {
      /* prefetch is best-effort */
    } finally {
      prefetchingRanges = false
    }
  })()
}
