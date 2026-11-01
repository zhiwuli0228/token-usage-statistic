# Testing Guide

## Framework

Vitest, with tests under `test/**/*.test.ts`.

## Commands

```bash
npm run test          # run once
npm run test:watch    # watch
npm run test:bundle   # built client.js smoke
npm run typecheck
npm run check         # typecheck + build + test + bundle smoke
```

## Required Test Areas

### Host Sampling

- event → sample extraction
- `turn:step` replacement
- compaction identity
- v1 → v2 migration
- invalid input rejection

### Store / Ledger

- fold totals, provider/model, day, session
- replacement and idempotency
- stale seq ignored
- ledger load/append
- fork boundary

### Pricing / Cost

- event-time rule matching
- peak/off-peak
- aliases
- unpriced fail-closed
- mixed currency

### API

- exact route matching
- loopback guard
- GET/HEAD only
- error responses
- no waiting on slow session-name refresh

### Accounts / Budgets / Export

- scheme parsing
- JSON Pointer parsing
- refresh status
- budget warn/exceeded/incomplete
- CSV BOM/CRLF/escaping/formula defense
- JSON schema version

### Client / Cache

- cache TTL
- today prefetch
- 7/30 preload
- first-frame render
- bundle smoke

## Fixtures

Use `test/helpers.ts` for canonical samples. Do not commit real credentials, prompts, or large logs.

## Rule

A bugfix needs a regression test when practical. A UI change needs a manual checklist in the PR or change doc.
