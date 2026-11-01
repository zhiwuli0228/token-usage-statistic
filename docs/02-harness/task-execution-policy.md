# Task Execution Policy

## Change Size

Prefer small changes. A change should usually affect one major capability:

- sampling / ledger
- pricing / cost
- store / snapshot
- accounts / budgets
- export
- HTTP API
- Client panel / cache
- build / release / docs

## Implementation Sequence

1. Define behavior.
2. Identify affected files and contracts.
3. Add or update tests.
4. Implement.
5. Run verification.
6. Update docs/current state.

## Coding Sequence

For a new Host capability:

1. type/model definitions
2. pure logic
3. service function
4. API route
5. tests
6. docs

For a new Client capability:

1. state and data source
2. pure formatting/helpers
3. component with `h()`
4. i18n keys
5. cache/loading behavior
6. tests + bundle smoke
7. docs

## Output Contract

If a change writes files or adds a route, document:

- path or endpoint
- required fields
- failure behavior
- whether it is durable truth or rebuildable cache
- privacy impact

## Release Gate

Implementation is not a release. Do not bump the version or publish until the user explicitly asks.
