# Agent Behavior

## Required Behavior

Agents working on this project must:

- preserve the ledger-first architecture
- keep Host and Client separated
- keep changes small and reviewable
- write tests for core logic
- update `docs/00-project/current-state.md` after completion
- avoid introducing infrastructure or dependencies not requested
- keep API routes thin
- treat cost as an estimate, never as provider truth
- respect the privacy boundary
- wait for an explicit release instruction

## Forbidden Behavior

Agents must not:

- bump the version, tag, publish to npm, or create a GitHub release without being asked
- write credentials or raw provider payloads to any response, cache, export, or doc
- put an unbounded history scan on the request path
- register `prefix` routes
- import React or use JSX in the Client bundle
- hide durable state outside the documented files
- present a partial cost as a complete total
- perform unrelated refactoring
- silently discard sampling or parsing failures

## When Unclear

1. Inspect the relevant docs.
2. Inspect the relevant source and tests.
3. Propose a small plan.
4. Avoid broad implementation.
