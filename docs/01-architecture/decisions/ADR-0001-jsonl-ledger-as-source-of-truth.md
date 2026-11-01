# ADR-0001: JSONL Ledger as Source of Truth

## Status

Accepted

## Context

DSH session events are durable, but their persistence format is owned by DSH. The plugin needs a local, replayable record that survives plugin reloads, HMR, and restarts.

## Decision

Store accepted usage samples as one JSON object per line in `usage.jsonl`.

The ledger is append-only. On activation, replay it into an in-memory fold.

## Consequences

Benefits:

- Survives restarts and reloads.
- Human-readable and easy to back up.
- Replayable after pricing changes.
- No database service or migration machinery.

Trade-offs:

- The file grows without bound until rotation is implemented.
- Append ordering must be serialized.
- Invalid lines must be skipped defensively.
