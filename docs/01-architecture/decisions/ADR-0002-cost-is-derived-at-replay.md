# ADR-0002: Cost Is Derived at Replay

## Status

Accepted

## Context

Provider prices change. Storing a cost amount at sampling time would freeze an estimate that may later be wrong.

## Decision

The ledger stores only raw token buckets, route, model, and event time.

Cost is computed when samples are folded, using the pricing rule effective at the event time.

## Consequences

Benefits:

- Pricing catalog updates can reprice history.
- The ledger stays small and provider-agnostic.
- No stale currency amounts in durable data.

Trade-offs:

- Replay must run the pricer.
- A changed rule changes historical estimates.
- Unpriced calls must be represented explicitly.
