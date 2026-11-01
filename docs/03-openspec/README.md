# Change Process (OpenSpec-style)

This repository does not currently mount an `openspec/` tool directory. The section keeps the **proposal → design → spec → tasks → archive** discipline used by the reference project, adapted to this plugin.

Use it for any non-trivial change: new APIs, storage changes, pricing changes, account sources, loading strategy, or release automation.

## Change Directory

For a planned change, create:

```text
docs/03-openspec/changes/<change-id>/
├── proposal.md
├── design.md
├── spec.md
└── tasks.md
```

`change-id` format: `YYYYMMDD-short-slug`.

## Proposal Rule

`proposal.md` must state:

- problem
- goal
- in scope
- out of scope
- affected Host/Client modules
- storage/API impact
- privacy impact
- risks
- verification plan

## Design Rule

`design.md` must state:

- data flow
- module responsibilities
- request/response or file contracts
- failure behavior
- memory/performance behavior
- security considerations
- tests

Record a durable architectural choice as an ADR under `docs/01-architecture/decisions/`.

## Spec Rule

`spec.md` must describe observable behavior:

- inputs
- outputs
- state transitions
- error states
- compatibility
- acceptance examples

It must not be a file-by-file implementation diary.

## Tasks Rule

`tasks.md` must be an ordered checklist:

- one capability per task
- tests included
- docs/current-state update included
- release explicitly out of scope unless requested

## Bugfix Rule

For a bugfix, record:

- symptom
- root cause
- regression test
- affected module
- risk

A bugfix does not need a full proposal, but it must add a regression test when practical.

## Archive Rule

When a change is complete:

- update `docs/00-project/current-state.md`
- update affected architecture/domain docs
- move the change directory or obsolete docs to `docs/99-archive/` if they are no longer active

## Release Rule

A completed change is not a release. Do not bump the version, tag, publish, or create a GitHub release until the user explicitly instructs it.
