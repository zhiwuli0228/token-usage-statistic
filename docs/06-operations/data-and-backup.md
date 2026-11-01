# Data and Backup

## Durable Data

```text
%DSH_HOME%\token-usage-statistic\usage.jsonl
```

The ledger is the only durable source of truth for usage.

## Caches and Receipts

```text
accounts.json     # normalized account snapshot; safe to delete
activation.json   # last activation route/status; safe to delete
```

Browser cache:

```text
localStorage: token-usage-statistic:cache:v3:*
```

30-minute TTL. Safe to clear.

## Backup

1. Disable the plugin.
2. Copy `usage.jsonl` (and optionally `accounts.json`).
3. Re-enable the plugin.

Do not copy the ledger while an append is in flight if you need a perfectly consistent snapshot. Stopping the plugin first is safest.

## Restore

1. Disable the plugin.
2. Replace `usage.jsonl`.
3. Re-enable.
4. Backfill may add missing historical sessions.

## Reset

1. Disable the plugin.
2. Delete `usage.jsonl`.
3. Re-enable.

The ledger is rebuilt from live events and `sessionPersistence`.

## Rotation

Not implemented yet. Long-running installations grow the ledger without bound. Plan rotation for 1.1.

## Migration

- v1 records without `sampleKey` migrate to `assistant:<seq>` at load.
- Invalid lines are skipped and counted.
- Cost is never stored; it is recomputed on replay.
