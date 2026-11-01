# Verification Policy

Every change must define verification.

## Required Commands

```bash
npm run typecheck
npm run test
npm run build
npm run test:bundle
node tools/check-contract.mjs
```

`npm run check` runs the first four.

## Host Logic

- Unit tests for pure functions and folds.
- Replacement/idempotency tests for `sessionId#sampleKey`.
- Fork-boundary tests for backfill.
- Pricing tests for event-time matching and fail-closed behavior.
- API tests for exact routes, loopback guard, methods, and errors.

## Client Logic

- Cache read/write/TTL tests.
- Prefetch tests.
- First-frame render test with a fake React.
- Bundle smoke for the built `client.js`.
- Manual panel checks for layout, tab switching, range switching, and chart clicks.

## UI Manual Checklist

For panel changes:

1. Panel opens on Today.
2. Today's data appears without a full-page loading state.
3. 7 days / 30 days switch quickly.
4. Chart metric switch changes the summary and bars.
5. Accounts tab renders statuses.
6. Export links download the expected files.
7. Refresh button works.

## Forbidden

Do not mark a task complete without tests or a manual verification checklist. Do not claim a release succeeded until npm and GitHub both confirm it.
