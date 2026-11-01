# Change Snapshot Policy

## Purpose

Keep future agents oriented after each change.

## Required Update

After every completed change, update:

```text
docs/00-project/current-state.md
```

Record:

- implemented capabilities
- changed contracts (storage/API/UI)
- new tests
- known gaps
- release state (published vs unreleased)

## Bugfixes

Record:

- symptom
- root cause
- regression test
- affected module
- risk

## Releases

Record:

- version
- npm publish result
- GitHub release result
- any remaining manual setup

## Archive

Move obsolete or superseded docs to `docs/99-archive/` rather than deleting history.
