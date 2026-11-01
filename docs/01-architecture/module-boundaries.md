# Module Boundaries

## Host Modules

### `usage.ts`

Pure functions only: token buckets, day keys, event sampling, sample migration, sanitization.

Must not do I/O or know about HTTP.

### `pricing.ts`

Price rules, aliases, and event-time matching. Must be deterministic and testable.

Must not write files or query providers.

### `cost.ts`

Cost accumulators and fail-closed rendering.

Must not contain provider-specific pricing tables.

### `store.ts`

In-memory fold over accepted samples: totals, provider/model, day, session, recent.

Must not append to the ledger (the caller owns persistence).

### `ledger.ts`

JSONL replay loader and serialized append queue.

Must not price samples or build views.

### `collector.ts`

Session event → normalized usage sample. Owns `turn:step` / compaction identity.

Must not persist or aggregate.

### `backfill.ts`

Incremental historical scan over `sessionPersistence`, starting after the fork boundary.

Must not block the live feed or the HTTP request path.

### `accounts/`

Account types, network boundary, schemes, JSON Pointer parsing, discovery/refresh/cache.

Must not leak credentials into normalized snapshots.

### `budgets.ts`

Daily/monthly windows from stores' cost accumulators.

Must not invent a partial sum when cost is incomplete.

### `export.ts`

CSV/JSON projections and CSV injection defense.

Must not export prompts, replies, paths, credentials, or raw provider payloads.

### `api.ts`

Thin route layer: parse query, call store/accounts/budgets, write response.

Must not contain fold, pricing, account, or export logic.

### `config.ts`

Config normalization and defaults. Invalid values fall back safely.

### `sessionNames.ts`

Workspace and session-title cache with TTL and in-flight deduplication.

Must be best-effort: a title failure must never fail a usage request.

### `index.ts`

Wiring only: load ledger, create services, register routes, start backfill/account refresh.

## Client Modules

### `panel.ts`

Presentation. Builds elements with `h()`, reads snapshots, manages tabs/ranges/chart state.

Must not import React, use JSX, read the ledger, or call credentials.

### `cache.ts`

LocalStorage snapshot cache, today prefetch, range preload.

Must be best-effort and tolerate disabled/full storage.

### `plugin.ts`

Slot registration and sidebar icon.

### `i18n.ts`

EN/ZH dictionaries and locale binding.

### `format.ts`

Formatting only; no network or state.

### `react.ts`

Bound React access; the single place that keeps the shell's React instance.

### `index.ts`

Module-loader entry; resolves React from the shell seed.

## Boundary Rules

- Host logic is testable without HTTP.
- Client logic is presentation-only.
- Pure modules do not import I/O modules.
- The API layer is a thin adapter.
- Any new route must be registered as `kind: 'exact'`.
- Any new durable file must be documented in `storage-contract.md`.
