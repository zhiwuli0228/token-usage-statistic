# Harness Standard

## Purpose

The harness keeps AI-assisted development aligned with the project's architecture, privacy boundary, verification expectations, and release policy.

## Harness Layers

### 1. Context Layer

What the agent must know before work:

- project brief and current state
- architecture and module boundaries
- storage contract
- relevant domain rules
- relevant ADRs

### 2. Constraint Layer

What the agent must not violate:

- no release without explicit user instruction
- no credentials in responses, caches, exports, logs, or docs
- no unbounded history scans on the request path
- no `prefix` route registration
- no React import or JSX in the Client bundle
- no hidden durable state outside documented files
- no partial cost presented as a total

### 3. Execution Layer

How work should be implemented:

- small, reviewable changes
- pure functions for sampling, pricing, folding, formatting
- thin API routes
- Host/Client separation
- explicit output contracts
- tests for core logic

### 4. Verification Layer

How work is validated:

- `npm run typecheck`
- `npm run test` (vitest)
- `npm run build`
- `npm run test:bundle`
- `node tools/check-contract.mjs`
- manual panel checks for UI changes
- restart DSH Desktop for Host changes

### 5. Continuity Layer

How future agents resume:

- update `docs/00-project/current-state.md`
- update affected docs
- preserve ADRs
- record release state accurately

## Required Agent Behavior

Before implementation:

1. Read the relevant docs.
2. Identify affected Host/Client modules.
3. Identify storage/API/UI contract impact.
4. Identify tests to add.
5. Keep scope small.

After implementation:

1. Run or specify verification.
2. Update docs and current state.
3. Do not bump the version or publish unless told.
