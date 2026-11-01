# Change: {change_name}

Date: {YYYY-MM-DD}
Status: draft | implemented | superseded

## 1. Summary

## 2. Problem

What was observed, and what evidence shows it.

## 3. Approach

Chosen design and the alternatives that were rejected.

## 4. Affected Modules

- host:
- client:
- docs:
- build/release:

## 5. Contracts

- ledger:
- HTTP route:
- UI state / cache:
- export format:
- privacy:

State "none" explicitly for contracts that did not change.

## 6. Verification

- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `npm run test:bundle`
- [ ] `node tools/check-contract.mjs`
- [ ] Manual panel check (if UI changed)

Results:

## 7. Risks and Rollback

## 8. Follow-ups

## 9. Release

This record does not authorize a release. Wait for explicit user instruction.
