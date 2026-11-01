# UI Loading Strategy

## Goal

The panel must show real data immediately. It must never block on the widest requested range.

## Default

The panel opens on **Today** (`days=1`), not 30 days.

## Progressive Hydration

When the user selects a wider range, the client widens in stages:

```text
1 day → 7 days → 30 days → all
```

Each stage replaces the previous snapshot. The UI keeps showing the last real data while the next stage loads.

`phase` values:

| Phase | Meaning |
| --- | --- |
| `today` | Only today's snapshot is shown |
| `partial` | A shorter window is shown while a wider one loads |
| `full` | The requested range is fully loaded |

## Cache

`src/client/cache.ts` stores snapshots in `localStorage` with a 30-minute TTL:

- `summary:1`, `summary:7`, `summary:30`, `summary:all`
- `daily:1`, `daily:7`, `daily:30`, `daily:all`

On mount, the hook uses the exact range cache if present, otherwise the widest shorter cache. It then refreshes only the missing part.

## Prefetch

- Client activation prefetches today's summary and daily snapshot.
- When the panel opens, after a short delay, it preloads 7-day and 30-day summary/daily snapshots.
- Prefetch is best-effort and deduplicated by a module-level guard.

## Polling

- Summary refresh defaults to 15 seconds.
- Polling only fetches the final requested range, not every stage.
- Hidden documents skip the poll tick.

## Request-Path Budget

The Host must not await slow auxiliary work in `summary` or `daily`:

- Session-title lookup runs in the background with a 30-second TTL.
- Workspace lookup is synchronous and cheap.
- Backfill runs independently and is not part of the request path.

## UX States

| State | Rendering |
| --- | --- |
| No cache, first load | `loading` |
| Cached data, refreshing | cached numbers + subtle progress notice |
| Partial stage | current data + "showing partial data" notice |
| Full range | no notice |
| Request failure | last data + error notice + retry |
