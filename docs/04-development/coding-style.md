# Coding Style

## TypeScript

- ES2022, ESM, strict mode.
- Prefer `type` imports for types.
- Use pure functions for sampling, pricing, folding, formatting.
- Keep I/O at the edges.
- Use explicit return types on exported functions.
- Keep `any` out of new code; use narrow interfaces.

## Client

- Do not import React at build time; use the bound React via `src/client/react.ts`.
- Do not use JSX. Build elements with `h()`.
- Keep components presentation-only.
- Use theme tokens (`--dsw-alias-*`) instead of hard-coded colors where possible.
- Keep i18n keys in `src/client/i18n.ts` for both EN and ZH.
- Cache and network behavior belongs in hooks or `cache.ts`, not in render paths.

## Host

- Keep API routes thin.
- Keep credentials inside the Host.
- Do not put slow auxiliary work on the request path.
- Use `unknown` at the event boundary and sanitize before storing.
- Preserve raw failure information only in logs, never in responses.

## Naming

- Files: lower camel / kebab as already used (`sessionNames.ts`, `api.ts`).
- Types: PascalCase.
- Functions/variables: camelCase.
- Constants: UPPER_SNAKE_CASE for true constants.
- Sample keys: `turn:step`, `compaction:<id>`.

## Comments

- Code identifiers are English.
- Comments may be Chinese for domain-specific rationale.
- Document invariants, not line-by-line behavior.

## Error Handling

- Fail closed for cost.
- Skip invalid ledger lines and count them.
- Return coarse error codes to the Client.
- Never log credentials or raw provider payloads.
