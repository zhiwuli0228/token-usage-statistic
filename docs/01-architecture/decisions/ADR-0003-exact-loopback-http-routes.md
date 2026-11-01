# ADR-0003: Exact Loopback HTTP Routes

## Status

Accepted

## Context

The DSH Web carrier accepts `prefix` route registrations but does not dispatch them. The panel also must not expose usage or account data to remote peers.

## Decision

Register every route with `kind: 'exact'`.

All routes:

- accept only `GET` and `HEAD`
- reject non-loopback peers with `403`
- send `cache-control: no-store`
- return a JSON error for unknown paths

## Consequences

Benefits:

- Routes actually dispatch on the current carrier.
- No LAN exposure by default.
- Simple, testable request handling.

Trade-offs:

- Each endpoint must be registered separately.
- Remote access requires an explicit future design, not a hidden side effect.
