# ADR-0005: Credentials Never Leave the Host

## Status

Accepted

## Context

Account balance queries need provider credentials. The browser panel and exports must not become a credential leak path.

## Decision

Resolve credentials only inside the Host through `ctx.credentials`.

Never serialize:

- access tokens
- API key values
- authorization headers
- raw provider payloads
- credential references beyond a configured monitor id

Accounts are normalized to numbers, labels, statuses, and coarse error codes before they reach the Client or disk.

## Consequences

Benefits:

- The browser never receives a secret.
- `accounts.json` and exports are safe to share.
- Network failure details stay coarse.

Trade-offs:

- Debugging a provider response requires Host-side logging with redaction.
- A new account source must implement normalization, not just pass JSON through.
