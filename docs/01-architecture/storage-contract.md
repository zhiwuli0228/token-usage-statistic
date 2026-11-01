# Storage Contract

## Principle

The JSONL ledger is the durable source of truth. Everything else is a derived view, a rebuildable cache, or an operational receipt.

## Usage Ledger

Default path:

```text
%DSH_HOME%\token-usage-statistic\usage.jsonl
```

Override with `dataFile`.

Each line is one accepted v2 sample:

```json
{
  "version": 2,
  "sessionId": "session-...",
  "seq": 42,
  "time": 1793493772515,
  "day": "2026-11-01",
  "sampleKey": "3:1",
  "kind": "assistant",
  "provider": "deepseek-account",
  "model": "deepseek-flash",
  "buckets": {
    "input": 1200,
    "output": 300,
    "cacheRead": 8000,
    "cacheWrite": 0
  }
}
```

### Invariants

- `sessionId#sampleKey` is the replacement key.
- A sample with a lower `seq` than the stored sample is ignored.
- The exact same report is idempotent.
- Cost is **not** stored. It is recomputed from the current pricing rules at replay time.
- v1 records (without `sampleKey`) migrate to `assistant:<seq>` on load.
- Invalid lines are skipped and counted, never silently treated as valid.

## Derived / Rebuildable State

| File | Type | Notes |
| --- | --- | --- |
| in-memory folds | derived | Rebuilt by replaying the ledger |
| `accounts.json` | cache | Last normalized account snapshot; safe to delete |
| `activation.json` | receipt | Last activation route/status; safe to delete |
| browser `localStorage` | cache | Summary/daily snapshots with 30-minute TTL |

## Accounts Cache

`accounts.json` contains only normalized account views:

- id, display name, source, status
- balance numbers and currency
- quota windows
- coarse error codes

It must never contain access tokens, authorization headers, API-key values, or raw provider responses.

## Browser Cache

Keys are prefixed with `token-usage-statistic:cache:v3:`.

- `summary:1`, `summary:7`, `summary:30`, `summary:all`
- `daily:1`, `daily:7`, `daily:30`, `daily:all`

Entries expire after 30 minutes. Cache misses or malformed entries fall back to a fresh request.

## Export Contract

JSON export schema: `1.0.0`.

Required top-level fields:

- `schemaVersion`
- `generatedAt`
- `days`
- `sessions`
- `budgets`
- `accounts`

Daily CSV columns:

```text
day, provider, model, calls, input, output, cacheRead, cacheWrite,
tokens, cacheHitRate, cost, currency, costComplete, pricedCalls, unpricedCalls
```

Sessions CSV columns:

```text
sessionId, providers, models, calls, input, output, cacheRead, cacheWrite,
tokens, cacheHitRate, cost, currency, costComplete, pricedCalls,
unpricedCalls, firstAt, lastAt
```

CSV is UTF-8 with BOM, CRLF line endings, quoted text, and a leading apostrophe for cells starting with `=`, `+`, `-`, or `@`.

## Backup and Reset

- Backup: copy `usage.jsonl` while the plugin is inactive.
- Reset: disable the plugin, delete `usage.jsonl`, enable again (history is rebuilt from persistence).
- `accounts.json` and `activation.json` may be deleted independently.
- The ledger currently has no rotation; long-running installations grow the file.
