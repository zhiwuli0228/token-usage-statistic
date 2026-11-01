# AGENTS.md

This file defines the project-level rules for AI agents working on **token-usage-statistic**.

It is the entry contract for agent work. Detailed rules live under `docs/`; this file states what must never be violated, what to read before acting, and how work is considered complete.

## Precedence

When instructions conflict, apply this order:

1. `AGENTS.md` (this file)
2. `docs/02-harness/*`
3. `docs/01-architecture/*` and `docs/05-domain/*`
4. `docs/00-project/*` and `docs/04-development/*`
5. Change records under `docs/03-changes/*`

A change record or plan never overrides a hard constraint in this file. If a request conflicts with one, stop and ask the user.

---

## 1. Project Identity

token-usage-statistic is a **DeepSeek Harness (DSH) plugin** that records local model usage and estimates cost by event time.

It helps users:

1. Sample token usage from DSH session events.
2. Persist a replayable local ledger.
3. Backfill history from `sessionPersistence`.
4. Estimate cost per sample using event-time pricing.
5. Inspect daily, session, provider, and model breakdowns.
6. Discover provider balances and subscription quota windows.
7. Configure daily/monthly budgets with warn/exceeded states.
8. Export daily CSV, sessions CSV, and versioned JSON without secrets.
9. Render everything in a sidebar panel on DSH Desktop and DSH Web.

It is **not**:

- A cloud billing or invoice reconciliation system.
- A prompt / reply / conversation archive.
- A multi-tenant server or shared team dashboard.
- A mandatory database or external analytics service.
- A replacement for provider invoices.
- A real-time alerting platform (budget notifications are not implemented).

Host and Client are separate. The Host owns filesystem, ledger, pricing, credentials, and HTTP. The Client is presentation-only.

---

## 2. Required Reading Order

Before any non-trivial change, read:

1. `AGENTS.md` (this file)
2. `docs/README.md`
3. `docs/00-project/project-brief.md`
4. `docs/00-project/current-state.md`
5. `docs/02-harness/harness-standard.md`
6. `docs/04-development/development-guide.md`

### Host / Sampling / Pricing Work

Also read:

1. `docs/05-domain/usage-sample-model.md`
2. `docs/05-domain/pricing-rules.md`
3. `docs/01-architecture/storage-contract.md`
4. `docs/01-architecture/module-boundaries.md`

### Account / Budget Work

Also read:

1. `docs/05-domain/account-balance-schemes.md`
2. `docs/05-domain/budget-rules.md`
3. `docs/06-operations/security-policy.md`

### API / Storage / Export Work

Also read:

1. `docs/01-architecture/storage-contract.md`
2. `docs/05-domain/export-format.md`
3. `docs/05-domain/privacy-boundary.md`
4. `docs/01-architecture/decisions/ADR-0003-exact-loopback-http-routes.md`

### Client / Panel Work

Also read:

1. `docs/04-development/client-development.md`
2. `docs/01-architecture/ui-loading-strategy.md`
3. `docs/01-architecture/design.md`
4. `docs/01-architecture/decisions/ADR-0004-progressive-hydration-and-cache.md`

### Release / Operations Work

Also read:

1. `docs/06-operations/installation-guide.md`
2. `docs/06-operations/release-guide.md`
3. `docs/06-operations/security-policy.md`
4. `docs/06-operations/data-and-backup.md`

### Change Record Work

Also read:

1. `docs/03-changes/README.md`
2. `docs/07-templates/change-record-template.md`
3. `docs/07-templates/design-template.md` for large changes

---

## 3. Hard Constraints

These constraints take precedence over any change record or plan.

### 3.1 Release Only on Explicit User Instruction

Do **not** bump the version, create a tag, publish to npm, or create a GitHub release unless the user explicitly instructs it.

A completed change is not a release. Local verification is not a release. Do not "prepare" a release by bumping versions or writing release notes on your own.

Current release state:

- Latest published version: `1.0.2`
- `main` contains unreleased performance and UX work
- npm trusted publishing is configured for `zhiwuli0228/token-usage-statistic`, workflow `release.yml`

### 3.2 Credentials Never Leave the Host

Credentials may be resolved only inside the Host via `ctx.credentials`.

Forbidden in any API response, cache file, export, log, test fixture, screenshot, or documentation example:

- access tokens
- authorization headers
- API key values
- cookies
- raw provider responses
- URLs containing embedded credentials

`accounts.json` and account responses may contain only normalized views: ids, display names, sources, statuses, balances, currencies, quota windows, and coarse error codes.

Network egress for account queries must remain:

- HTTPS only (loopback HTTP allowed)
- no redirect following
- bounded timeout (15 seconds)
- bounded response size (1 MiB)
- reject URLs with embedded credentials

### 3.3 The JSONL Ledger Is the Source of Truth

`usage.jsonl` is durable truth. In-memory folds and browser caches are derived and must be rebuildable.

Invariants:

- `sessionId#sampleKey` is the replacement key.
- A sample with a lower `seq` than the stored sample is ignored.
- The exact same report is idempotent.
- v1 records without `sampleKey` migrate to `assistant:<seq>` on load.
- Invalid lines are skipped and counted, never silently treated as valid.

Do not add durable state outside the documented files. Do not rewrite or compact history unless the change explicitly documents a migration and its verification.

### 3.4 Cost Is Derived at Replay and Fails Closed

Cost is **not stored** in the ledger. It is recomputed from current pricing rules at replay time.

- Unknown model, unknown price, or mixed currency must produce `null`, not a guessed amount.
- A partial sum must never be presented as a complete total.
- `costComplete`, `pricedCalls`, and `unpricedCalls` must stay visible so users can see when a total is incomplete.
- A pricing rule change must reprice history on the next replay, not require a ledger migration.

### 3.5 HTTP Routes Are Exact, Loopback-Only, and Read-Only

- Every route must be registered as `kind: 'exact'`. The current Web carrier accepts `prefix` registration but never dispatches it.
- Endpoints accept GET/HEAD only.
- Requests must originate from loopback.
- Responses must be `no-store`.
- Do not add remote access, authentication bypasses, or write endpoints.

Existing routes:

```text
/token-usage-statistic/api/summary
/token-usage-statistic/api/daily
/token-usage-statistic/api/accounts
/token-usage-statistic/export/daily.csv
/token-usage-statistic/export/sessions.csv
/token-usage-statistic/export.json
```

### 3.6 No Unbounded Work on the Request Path

Do not put a full-history scan, unbounded provider call, or unbounded session-title resolution on a request path.

Required pattern:

- keep folds in memory and rebuild them from the ledger at startup
- use progressive hydration: today → 7 days → 30 days → all
- use the browser snapshot cache with its TTL
- run backfill and account refresh in the background
- make session-title refresh best-effort, TTL-bounded, and deduplicated

A title or account failure must never fail a usage request.

### 3.7 Host and Client Stay Separate

Host (`src/host/`) may use Node APIs, the filesystem, credentials, and the network.

Client (`src/client/`) is presentation-only. It must not:

- import React or use JSX
- read the ledger or the filesystem
- call credentials or providers
- reimplement pricing or sampling
- import Host modules

React access is allowed only through the bound instance in `src/client/react.ts`, which receives the shell's React seed. Elements are built with `h()`.

### 3.8 No Unrequested Dependencies or Infrastructure

The plugin has no runtime dependencies. Do not add a runtime dependency without explicit approval.

Do not introduce:

- databases or external services
- analytics or telemetry
- bundler/runtime swaps
- new HTTP frameworks

Dev dependencies may be added only when they directly serve build, typecheck, or test needs, and the change explains why.

### 3.9 Failures Must Be Visible

Do not silently discard sampling, parsing, pricing, or account failures.

- invalid ledger lines are skipped **and counted**
- unknown prices render as `null` with an explicit incomplete state
- account errors become coarse error codes
- UI failures must not crash the whole panel

### 3.10 Keep Scope Discipline

Do not perform unrelated refactoring, reformatting, or renaming in the same change. Keep diffs small and reviewable.

---

## 4. Expected Technology Stack

Use:

- TypeScript with `strict: true`
- ES2022 modules
- Node.js 20+
- esbuild for the Host and Client bundles
- Vitest for tests
- pnpm workspace shim (`pnpm-workspace.yaml`) and npm scripts
- React only through the shell-provided instance in `src/client/react.ts`

Do not use:

- JSX
- a second UI framework
- runtime npm dependencies
- `any` where a precise type is practical

Build outputs:

```text
index.js    # Host bundle
client.js   # Client bundle
cordis.patch.yml
locale/*.json
icon.svg
```

---

## 5. Recommended Project Structure

```text
token-usage-statistic/
├── AGENTS.md
├── README.md
├── package.json
├── cordis.patch.yml
├── esbuild.config.mjs
├── tsconfig.json
├── vitest.config.ts
├── index.js                 # built Host bundle
├── client.js                # built Client bundle
├── icon.svg
├── locale/
│   ├── en.json
│   └── zh.json
├── src/
│   ├── host/
│   │   ├── index.ts
│   │   ├── api.ts
│   │   ├── collector.ts
│   │   ├── usage.ts
│   │   ├── ledger.ts
│   │   ├── store.ts
│   │   ├── pricing.ts
│   │   ├── cost.ts
│   │   ├── backfill.ts
│   │   ├── budgets.ts
│   │   ├── export.ts
│   │   ├── config.ts
│   │   ├── sessionNames.ts
│   │   ├── types.ts
│   │   └── accounts/
│   │       ├── types.ts
│   │       ├── net.ts
│   │       ├── schemes.ts
│   │       └── registry.ts
│   └── client/
│       ├── index.ts
│       ├── plugin.ts
│       ├── panel.ts
│       ├── cache.ts
│       ├── i18n.ts
│       ├── format.ts
│       └── react.ts
├── test/
│   ├── helpers.ts
│   └── *.test.ts
├── scripts/
│   └── smoke-client.mjs
├── tools/
│   └── check-contract.mjs
├── docs/
│   ├── README.md
│   ├── 00-project/
│   ├── 01-architecture/
│   ├── 02-harness/
│   ├── 03-changes/
│   ├── 04-development/
│   ├── 05-domain/
│   ├── 06-operations/
│   ├── 07-templates/
│   └── 99-archive/
└── .github/
    └── workflows/
```

---

## 6. Module Boundaries

### 6.1 `usage.ts`

Pure functions only: token buckets, day keys, event sampling, sample migration, sanitization.

Must not do I/O or know about HTTP.

### 6.2 `pricing.ts`

Price rules, model aliases, and event-time matching. Deterministic and testable.

Must not write files or query providers.

### 6.3 `cost.ts`

Cost accumulators and fail-closed rendering.

Must not contain provider-specific pricing tables.

### 6.4 `store.ts`

In-memory fold over accepted samples: totals, provider/model, day, session, recent.

Must not append to the ledger; the caller owns persistence.

### 6.5 `ledger.ts`

JSONL replay loader and serialized append queue.

Must not price samples or build views.

### 6.6 `collector.ts`

Session event → normalized usage sample. Owns `turn:step` and compaction identity.

Must not persist or aggregate.

### 6.7 `backfill.ts`

Incremental historical scan over `sessionPersistence`, starting after the fork boundary.

Must not block the live feed or the HTTP request path.

### 6.8 `accounts/`

Account types, network boundary, schemes, JSON Pointer parsing, discovery/refresh/cache.

Must not leak credentials into normalized snapshots.

### 6.9 `budgets.ts`

Daily/monthly windows from stores' cost accumulators.

Must not invent a partial sum when cost is incomplete.

### 6.10 `export.ts`

CSV/JSON projections and CSV injection defense.

Must not export prompts, replies, paths, credentials, or raw provider payloads.

### 6.11 `api.ts`

Thin route layer: parse query, call store/accounts/budgets, write response.

Must not contain fold, pricing, account, or export logic.

### 6.12 `config.ts`

Config normalization and defaults. Invalid values fall back safely.

### 6.13 `sessionNames.ts`

Workspace and session-title cache with TTL and in-flight deduplication.

Must be best-effort; a title failure must never fail a usage request.

### 6.14 `index.ts`

Wiring only: load ledger, create services, register routes, start backfill and account refresh.

### 6.15 Client Modules

- `panel.ts`: presentation, tabs, ranges, chart state
- `cache.ts`: localStorage snapshots, today prefetch, range preload
- `plugin.ts`: slot registration and sidebar icon
- `i18n.ts`: EN/ZH dictionaries and locale binding
- `format.ts`: formatting only
- `react.ts`: bound React access
- `index.ts`: module-loader entry

Client modules must not import Host modules.

---

## 7. Sampling and Storage Contracts

### 7.1 Sampling Sources

Usage is sampled from:

- `assistant/message`
- `assistant/chunk`
- `compaction/summary`

A later sample for the same `turn:step` replaces the earlier one without double counting.

### 7.2 Ledger

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

Do not add fields without updating `docs/01-architecture/storage-contract.md`.

### 7.3 Derived State

| File | Type | Notes |
| --- | --- | --- |
| in-memory folds | derived | rebuilt by replaying the ledger |
| `accounts.json` | cache | normalized account snapshot; safe to delete |
| `activation.json` | receipt | last activation route/status; safe to delete |
| browser `localStorage` | cache | summary/daily snapshots, 30-minute TTL |

### 7.4 Browser Cache

Keys are prefixed with `token-usage-statistic:cache:v3:`.

```text
summary:1  summary:7  summary:30  summary:all
daily:1    daily:7    daily:30    daily:all
```

Cache entries expire after 30 minutes. Malformed entries fall back to a fresh request.

### 7.5 Exports

JSON export schema: `1.0.0`. Required top-level fields:

```text
schemaVersion, generatedAt, days, sessions, budgets, accounts
```

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

Exports must not include prompts, replies, filesystem paths, credentials, or raw provider payloads.

---

## 8. Pricing and Cost Rules

- Price is matched by each sample's **event time**, not by wall-clock time at replay.
- DeepSeek peak/off-peak rules use the Asia/Shanghai schedule.
- Model aliases must be resolved before price lookup.
- Unknown model or unknown price → `null`, with the call counted as unpriced.
- Mixed currencies must not be summed into one number.
- Budget comparisons must not treat an incomplete cost sum as complete.
- Follow `docs/05-domain/pricing-rules.md` for the current schedule, aliases, and rounding.

---

## 9. Account, Budget, and Export Rules

### 9.1 Accounts

- Discover accounts from the DSH Desktop account service, an official DeepSeek API key, or a configured `llm-pi-ai` provider.
- Resolve credentials only at refresh time inside the Host.
- Normalize every result into the documented account view shape.
- Unsupported sources must render as unsupported, not as zero balance.
- Cache failures as coarse error codes, not raw payloads.

### 9.2 Budgets

- Daily and monthly windows derive from cost accumulators.
- Warn threshold defaults to 80%; `exceeded` starts at 100%.
- `level` is `ok`, `warn`, `exceeded`, or `null`; there is no invented state.
- When cost is incomplete (unpriced samples or mixed currencies), `costComplete` is false and `spend`, `percent`, and `level` are `null` — never a partial comparison.

### 9.3 Exports

- Use the documented columns and schema version.
- Keep CSV injection defense.
- Do not add new columns without updating `docs/05-domain/export-format.md`.

---

## 10. Coding Rules

- Use TypeScript strict mode.
- Prefer pure functions for sampling, pricing, folding, and formatting.
- Keep modules small and single-purpose.
- Use explicit types for structured data.
- Avoid global mutable state.
- Do not swallow exceptions silently.
- Use `node:path` helpers instead of string path concatenation.
- Keep analyzer and API logic independent of each other.
- Keep locale strings in both `en.json` and `zh.json`.
- Handle disabled or full `localStorage` without crashing.
- Do not make network calls outside the documented account boundary.
- Follow `docs/04-development/coding-style.md`.

Recommended pattern for file I/O:

```ts
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'

const file = join(dataDir, 'usage.jsonl')
const text = await readFile(file, 'utf8')
```

Stream or bound reads when a file can grow. Do not load an unbounded ledger copy into multiple places.

---

## 11. Testing Rules

Use Vitest.

Required tests for relevant changes:

### Host core

- usage sampling and replacement
- v1 → v2 migration
- pricing by event time, aliases, fail-closed behavior
- cost accumulation and incomplete rendering
- store folding, replacement, range filtering
- ledger replay, invalid-line counting, append ordering
- backfill cursor and fork boundary
- budget states
- export columns and CSV injection defense

### Accounts

- JSON Pointer parsing
- scheme mapping
- normalized snapshot contains no secrets
- network boundary rejects non-HTTPS, redirects, oversized bodies

### API

- exact route registration
- loopback guard
- GET/HEAD only
- `no-store`
- safe error responses

### Client

- cache read/write/TTL and malformed entries
- today prefetch and 7/30 preload
- first-frame render with a fake React
- bundle smoke for built `client.js`

Fixtures must be small and synthetic. Do not commit real usage logs or provider payloads.

For UI changes, also run the manual checklist in `docs/02-harness/verification-policy.md`.

---

## 12. Change Records

This project uses a single, project-native change record for non-trivial changes. There is no proposal/design/spec/tasks pipeline.

### When Required

Write a record for:

- new or changed HTTP route
- ledger field, sample identity, or cache contract
- pricing rule, model alias, or budget behavior
- account source, scheme, or network boundary
- loading strategy, polling, or panel behavior
- export format or privacy boundary
- build, packaging, or release automation

Not required for typo fixes, documentation-only edits, or a one-line fix with no behavior or contract change.

### Location

```text
docs/03-changes/YYYYMMDD-short-slug.md
```

Start from `docs/07-templates/change-record-template.md`.

When a change needs diagrams, contract tables, or an alternatives analysis, add:

```text
docs/03-changes/YYYYMMDD-short-slug.design.md
```

from `docs/07-templates/design-template.md`.

### Contents

The record must answer, in order:

1. Summary — what changed and why.
2. Problem — observed behavior or gap, with evidence.
3. Approach — chosen design and rejected alternatives.
4. Affected modules — Host, Client, docs, build/release.
5. Contracts — ledger, HTTP, UI state, privacy; state "none" explicitly.
6. Verification — commands run and their results, plus manual checks for UI work.
7. Risks and rollback.
8. Follow-ups.

### Lifecycle

```text
draft → implemented → historical
```

A completed record stays under `docs/03-changes/` as history. Move it to `docs/99-archive/` only when it is superseded or no longer describes the system.

### Durable Decisions

Record architecture choices that outlive the change as an ADR under `docs/01-architecture/decisions/`. ADRs are numbered and never rewritten; supersede them with a new one.

### Bugfix

Use `docs/07-templates/bugfix-template.md`, or a short record with the same headings: symptom, root cause, fix, regression test, affected module, risk. A bugfix does not need a design document.

### Completion

- update `docs/00-project/current-state.md`
- update affected architecture and domain docs
- leave the record at `implemented` with its verification results

---

## 13. Recommended Development Flow

For non-trivial features:

```text
read docs
→ identify affected modules and contracts
→ write the change record
→ implement in small steps
→ add tests
→ run typecheck / test / build / bundle smoke / contract check
→ update docs/current-state
→ mark the record implemented
```

For small bug fixes:

1. Reproduce.
2. Identify root cause.
3. Fix minimally.
4. Add a regression test.
5. Update `current-state.md` if project state changed.

Do not create an oversized change package for a trivial bug.

For UI changes, verify the panel manually in DSH Desktop or DSH Web.

---

## 14. Standard Commands

Install:

```bash
pnpm install
# or
npm install
```

Typecheck:

```bash
npm run typecheck
```

Test:

```bash
npm run test
npm run test:watch
```

Build:

```bash
npm run build
```

Bundle smoke:

```bash
npm run test:bundle
```

Full check:

```bash
npm run check
```

Packaging contract:

```bash
node tools/check-contract.mjs
```

Local load:

```text
DSH Desktop: restart the app after Host changes; refresh after Client changes.
DSH Web:     dsh plugin --profile web add token-usage-statistic
             dsh web
```

Data directory:

```text
%DSH_HOME%\token-usage-statistic\
├── usage.jsonl
├── accounts.json
└── activation.json
```

---

## 15. Release Rules

Only when the user explicitly instructs a release:

1. Confirm the intended version and scope.
2. Update `package.json` version.
3. Update `README.md` version text and affected docs.
4. Run `npm run check` and `node tools/check-contract.mjs`.
5. Commit and push `main`.
6. Create and push the tag:

```bash
git tag -a vX.Y.Z -m "Release token-usage-statistic X.Y.Z"
git push origin vX.Y.Z
```

7. Watch the release workflow.
8. Verify npm with `--prefer-online`.
9. Verify the GitHub release page.

Do not:

- publish over an existing version
- tag a version that disagrees with `package.json`
- announce a release before npm confirms it
- treat a passing build as permission to release

Follow `docs/06-operations/release-guide.md` for the full procedure.

---

## 16. Required Finalization for Every Change

Before considering work complete:

- [ ] Code is implemented and scoped to the request.
- [ ] Tests are added or updated.
- [ ] `npm run typecheck` passes.
- [ ] `npm run test` passes.
- [ ] `npm run build` passes.
- [ ] `npm run test:bundle` passes for Client changes.
- [ ] `node tools/check-contract.mjs` passes for packaging changes.
- [ ] Storage/API contract changes are documented.
- [ ] Relevant docs are updated.
- [ ] A change record exists for non-trivial work and reflects what shipped.
- [ ] `docs/00-project/current-state.md` is updated.
- [ ] No credentials, prompts, replies, paths, or raw provider payloads were added to outputs.
- [ ] No mandatory dependency or infrastructure was introduced.
- [ ] The ledger remains the source of truth and cost remains derived.
- [ ] No version bump, tag, npm publish, or GitHub release was performed without instruction.
