# ADR-0004: Progressive Hydration and Cache

## Status

Accepted

## Context

A full 30-day or all-time snapshot can be slow enough that a full-page loading state feels broken. Most users only need today's numbers on entry.

## Decision

- Default to today.
- Load wider ranges in stages: 1 → 7 → 30 → all.
- Cache snapshots in `localStorage` with a 30-minute TTL.
- Prefetch today at activation and 7/30-day windows when the panel opens.
- Reuse the widest cached window when widening.
- Poll only the final requested range.

## Consequences

Benefits:

- Real numbers appear immediately.
- Switching ranges uses cached data.
- The slowest query no longer blocks first paint.

Trade-offs:

- Multiple requests per widened range.
- A short stale window before refresh.
- Cache invalidation is TTL-based, not event-driven.
