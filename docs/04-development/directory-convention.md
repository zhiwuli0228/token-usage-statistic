# Directory Convention

## Source

```text
src/
├── host/
│   ├── accounts/
│   ├── api.ts
│   ├── backfill.ts
│   ├── budgets.ts
│   ├── collector.ts
│   ├── config.ts
│   ├── cost.ts
│   ├── export.ts
│   ├── index.ts
│   ├── ledger.ts
│   ├── pricing.ts
│   ├── sessionNames.ts
│   ├── store.ts
│   ├── types.ts
│   └── usage.ts
└── client/
    ├── cache.ts
    ├── format.ts
    ├── i18n.ts
    ├── index.ts
    ├── panel.ts
    ├── plugin.ts
    └── react.ts
```

## Tests

```text
test/
├── api.test.ts
├── accounts.test.ts
├── budgets.test.ts
├── cache.test.ts
├── client.test.ts
├── client-entry.test.ts
├── collector.test.ts
├── config.test.ts
├── cost.test.ts
├── export.test.ts
├── ledger.test.ts
├── pricing.test.ts
├── store.test.ts
└── usage.test.ts
```

## Build and Tooling

```text
index.js / client.js       # committed build outputs
esbuild.config.mjs         # build
tsconfig.json              # typecheck
vitest.config.ts           # tests
scripts/smoke-client.mjs   # bundle smoke
tools/check-contract.mjs   # packaging contract
```

## Docs

```text
docs/
├── 00-project/
├── 01-architecture/
├── 02-harness/
├── 03-changes/
├── 04-development/
├── 05-domain/
├── 06-operations/
├── 07-templates/
├── 99-archive/
└── screenshots/
```

## Naming

- Host data file: `usage.jsonl`
- Account cache: `accounts.json`
- Activation receipt: `activation.json`
- Route prefix: `/token-usage-statistic/`
- Panel id: `token-usage`
