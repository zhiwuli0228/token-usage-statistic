# Dependency Policy

## Principles

- Keep the shipped package dependency-free.
- Prefer platform APIs and pure TypeScript.
- Dev dependencies are allowed for build and tests only.
- Do not add a chart library for a simple bar chart.
- Do not add a database or external service.
- Do not add a React dependency; the DSH shell provides React at runtime.

## Current Dev Dependencies

- `typescript`
- `esbuild`
- `vitest`
- `@types/node`
- `@types/react`

## Forbidden as Runtime Dependencies

- databases / ORMs
- analytics SDKs
- charting frameworks
- credential or account SDKs that bypass `ctx.credentials`
- React / ReactDOM

## Optional / Future

Any future pricing or provider SDK must be optional, documented, and disabled by default.

## Rule

If a dependency adds a service, a build step on the user's machine, or a credential path, propose it as optional first.
