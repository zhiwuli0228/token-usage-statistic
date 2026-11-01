# Export Format

## Endpoints

```text
GET /token-usage-statistic/api/export/daily.csv
GET /token-usage-statistic/api/export/sessions.csv
GET /token-usage-statistic/api/export.json
```

All are read-only, loopback-only, and `no-store`.

## Daily CSV

One row per day + provider + model:

```text
day, provider, model, calls, input, output, cacheRead, cacheWrite,
tokens, cacheHitRate, cost, currency, costComplete, pricedCalls, unpricedCalls
```

## Sessions CSV

One row per session:

```text
sessionId, providers, models, calls, input, output, cacheRead, cacheWrite,
tokens, cacheHitRate, cost, currency, costComplete, pricedCalls,
unpricedCalls, firstAt, lastAt
```

## JSON

`schemaVersion: "1.0.0"`:

```json
{
  "schemaVersion": "1.0.0",
  "generatedAt": 1793493772515,
  "days": [],
  "sessions": [],
  "budgets": {},
  "accounts": []
}
```

## CSV Safety

- UTF-8 BOM
- CRLF line endings
- quoted text cells
- doubled quotes inside cells
- leading apostrophe for cells starting with `=`, `+`, `-`, or `@`

## Privacy

Exports contain only normalized usage, cost, budget, and account-status fields.

They must not contain:

- prompts
- replies
- file paths
- session titles that contain conversation text? (currently names are exported only if included by the caller; the default export allow-list does not add them)
- credentials
- raw provider payloads

## Failure Behavior

An unpriced total is exported as an empty cost with `costComplete=false`, not as a partial amount.
