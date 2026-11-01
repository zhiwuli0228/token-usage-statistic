# token-usage-statistic Docs Entry

This directory is the **project-level Harness Context Hub**.

It is used by humans and AI agents to understand project state, architecture, constraints, change rules, development standards, and domain behavior.

The agent entry contract is `AGENTS.md` at the repository root. Read it before this file; it defines the hard constraints and the precedence order.

## Reading Policy

Do not read every document blindly. Read documents based on task type.

### Required for Every Non-trivial Change

1. `README.md` (repository root)
2. `docs/00-project/project-brief.md`
3. `docs/00-project/current-state.md`
4. `docs/02-harness/harness-standard.md`
5. `docs/04-development/development-guide.md`

### Non-trivial Changes

Also read:

1. `docs/03-changes/README.md`
2. `docs/07-templates/change-record-template.md`
3. `docs/07-templates/design-template.md` for large changes

### Architecture Changes

Also read:

1. `docs/01-architecture/design.md`
2. `docs/01-architecture/module-boundaries.md`
3. `docs/01-architecture/storage-contract.md`
4. Relevant ADRs under `docs/01-architecture/decisions/`

### Host / Sampling / Pricing Work

Also read:

1. `docs/05-domain/usage-sample-model.md`
2. `docs/05-domain/pricing-rules.md`
3. `docs/01-architecture/storage-contract.md`

### Account / Budget Work

Also read:

1. `docs/05-domain/account-balance-schemes.md`
2. `docs/05-domain/budget-rules.md`
3. `docs/06-operations/security-policy.md`

### Client / Panel Work

Also read:

1. `docs/04-development/client-development.md`
2. `docs/01-architecture/ui-loading-strategy.md`
3. `docs/01-architecture/design.md`

### Release / Operations Work

Also read:

1. `docs/06-operations/installation-guide.md`
2. `docs/06-operations/release-guide.md`
3. `docs/06-operations/security-policy.md`

## Hard Rules

- **Do not release without the user's explicit instruction.** No version bump, tag, npm publish, or GitHub release on your own.
- Credentials must never leave the Host. They must not appear in API responses, caches, exports, logs, or documentation examples.
- The JSONL ledger is the source of truth. In-memory folds and caches must be rebuildable.
- Cost is derived at replay time, never stored as durable truth.
- HTTP routes are exact, loopback-only, read-only, and `no-store`.
- Do not put unbounded history scans on the request path. Use progressive hydration and background work.
- Every completed change must update `docs/00-project/current-state.md`.
- Every non-trivial change must include tests, a build, and a bundle smoke check.

## Directory Map

```text
docs/
├── 00-project/       # brief, current state, glossary, roadmap
├── 01-architecture/  # design, module boundaries, storage contract, ADRs
├── 02-harness/       # AI-assisted development harness standards
├── 03-changes/       # lightweight change records
├── 04-development/   # coding, testing, local run, client rules
├── 05-domain/        # token, pricing, accounts, budgets, exports
├── 06-operations/    # install, release, data, troubleshooting, security
├── 07-templates/     # reusable artifact templates
├── 99-archive/       # obsolete or historical docs
└── screenshots/      # README and storefront screenshots
```
