# Architecture Overview

## Layers

```text
DSH session events
  ↓
Host collector + pricing + store + ledger + accounts + budgets
  ↓
exact loopback HTTP routes
  ↓
Client sidebar row + panel
```

## Major Components

### Host

| Module | Responsibility |
| --- | --- |
| `usage.ts` | Pure token buckets, day keys, event sampling, v1→v2 migration |
| `pricing.ts` | Event-time price rules, peak/off-peak schedule, aliases |
| `cost.ts` | Additive cost accumulators and fail-closed rendering |
| `store.ts` | Folds samples by day/model/session, replacement, snapshots |
| `ledger.ts` | JSONL append queue and replay loader |
| `collector.ts` | Session event → usage sample |
| `backfill.ts` | Incremental historical scan with fork boundaries |
| `accounts/` | Account discovery, schemes, network boundary, refresh |
| `budgets.ts` | Daily/monthly budget windows |
| `export.ts` | CSV/JSON projection and injection defense |
| `api.ts` | Exact routes, loopback guard, response helpers |
| `config.ts` | Config normalization and defaults |
| `sessionNames.ts` | Workspace/session title cache |
| `index.ts` | `apply(ctx)`: wiring, ingestion, routes, backfill, accounts |

### Client

| Module | Responsibility |
| --- | --- |
| `plugin.ts` | Slot registration and module identity |
| `panel.ts` | Usage / Accounts / Export UI |
| `cache.ts` | Snapshot cache, today prefetch, range preload |
| `i18n.ts` | EN/ZH dictionaries and locale binding |
| `format.ts` | Number, money, time, session-id formatting |
| `react.ts` | Bound React access and `h()` wrapper |
| `index.ts` | Module-loader entry |

## Cross-cutting Concerns

- Local-first storage and loopback-only HTTP.
- Replayable ledger; derived folds and caches.
- Fail-closed cost rendering.
- Exact route paths (the Web carrier does not dispatch `prefix` routes).
- Progressive hydration and background preload.
- Credentials only inside the Host.
- No runtime dependencies in the shipped package.
