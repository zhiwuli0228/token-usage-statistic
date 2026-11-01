# Development Guide

## Prerequisites

- Node.js >= 20
- pnpm (lockfile is `pnpm-lock.yaml`) or npm
- DSH Desktop or `dsh web` for manual testing

## Install

```bash
pnpm install
# or
npm install
```

## Build

```bash
npm run build
```

Outputs:

```text
index.js    # Host bundle
client.js   # Client bundle
```

Both are committed because the plugin is installed as a prebuilt bundle.

## Typecheck and Tests

```bash
npm run typecheck
npm run test
npm run test:bundle
```

Full gate:

```bash
npm run check
node tools/check-contract.mjs
```

## Recommended Implementation Order

1. Define the behavior and contract.
2. Add or update tests.
3. Implement pure logic.
4. Wire the Host or Client.
5. Build and smoke.
6. Update docs and `docs/00-project/current-state.md`.

## Completion Criteria

A change is complete only when:

- code is implemented
- tests are added or updated
- `npm run typecheck` passes
- `npm run test` passes
- `npm run build` passes
- `npm run test:bundle` passes
- docs/current state are updated

## Release Gate

Do not bump the version or publish. The user triggers releases explicitly.
