# Current State

This file is the **project continuity snapshot**. Update it after every completed change.

## Current Phase

The plugin is usable and published. `1.0.2` is the latest npm release. `main` contains additional performance and UX work that has not been released.

## Published in 1.0.2

- [x] Host/Client TypeScript rewrite with esbuild bundles
- [x] Usage sampling from `assistant/message`, `assistant/chunk`, `compaction/summary`
- [x] `turn:step` replacement (chunk → message) without double counting
- [x] Fork-aware backfill from `sessionPersistence` with `inheritedEventCount`
- [x] JSONL ledger as replayable source of truth
- [x] Event-time pricing, DeepSeek peak/off-peak schedule, model aliases
- [x] Fail-closed cost rendering for unpriced calls
- [x] Provider account discovery and normalized balances
- [x] Generic JSON Pointer account monitors
- [x] Daily/monthly budgets with warn/exceeded states
- [x] Daily CSV, sessions CSV, versioned JSON exports
- [x] Usage / Accounts / Export tabs
- [x] Daily usage chart with clickable day details
- [x] Session and workspace names in session tables
- [x] README screenshots and installation guide
- [x] GitHub Actions CI and release workflow
- [x] npm trusted publishing

## On `main`, not yet released

- [x] Default range is today, not 30 days
- [x] Progressive hydration: today → 7 days → 30 days → all
- [x] Local snapshot cache and today prefetch
- [x] Background preload of 7-day and 30-day windows after the panel opens
- [x] Reuse the widest cached window when widening the range
- [x] Non-blocking session-title refresh (30s TTL, in-flight dedupe)
- [x] Fixed daily chart date-label clipping
- [x] Metric picker moved next to the chart with a live "current metric / total" line
- [x] Project docs hub initialized (`00-project` → `99-archive`)
- [x] Project-level agent rules initialized (`AGENTS.md`)

## Tests and Verification

- `vitest`: 128 tests across 15 files
- `npm run typecheck`
- `npm run build`
- `npm run test:bundle` (fake-shell bundle smoke)
- `node tools/check-contract.mjs`

## Current Constraints

- No release without explicit user instruction.
- No credentials in responses, caches, exports, logs, or docs.
- Exact loopback HTTP routes only.
- No unbounded history scans on the request path.
- Client bundle must not import React or use JSX.
- The JSONL ledger is durable truth; folds and caches are rebuildable.

## Known Gaps

- Subscription schemes are generic JSON Pointer mappings; no built-in Qwen/Kimi/MiniMax scheme yet.
- Ledger has no rotation or retention policy.
- No budget notification or webhook.
- Chart and panel visual polish is still in progress.
- Official plugin catalog PR is open and waiting for the repository-age gate.
- The running DSH Desktop must be restarted for Host changes to take effect.
- npm page still shows the README from the last published version until the next release.

## Next Recommended Work

1. Add more built-in subscription schemes.
2. Add ledger rotation / retention.
3. Add budget threshold notifications.
4. Improve chart interactions (heatmap, model filter).
5. Add incremental/paginated APIs if local history grows large.
