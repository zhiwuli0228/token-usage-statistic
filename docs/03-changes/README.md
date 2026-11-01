# Change Records

This section defines a lightweight, project-native change record for non-trivial changes.

The goal is continuity: the next agent should be able to read one file and understand **why** a change was made, **what** contracts it touched, and **how** it was verified.

## When a Record Is Required

Write a record for any non-trivial change:

- new or changed HTTP route
- ledger field, sample identity, or cache contract
- pricing rule, model alias, or budget behavior
- account source, scheme, or network boundary
- loading strategy, polling, or panel behavior
- export format or privacy boundary
- build, packaging, or release automation

A record is **not** required for:

- typo fixes
- documentation-only edits
- a one-line fix with no behavior or contract change

Every bug fix still needs a regression test when practical, and a short record when the root cause is not obvious.

## Location and Format

```text
docs/03-changes/YYYYMMDD-short-slug.md
```

`YYYYMMDD` is the date the record is created; `short-slug` is lowercase with hyphens.

Start from `docs/07-templates/change-record-template.md`.

For a large change that needs diagrams, contract tables, or alternatives, add:

```text
docs/03-changes/YYYYMMDD-short-slug.design.md
```

using `docs/07-templates/design-template.md`.

No index file is maintained. Search by date or slug; the filename is the id.

## Record Structure

A record should answer, in this order:

1. **Summary** — one paragraph: what changed and why.
2. **Problem** — the observed behavior or gap, with evidence.
3. **Approach** — the chosen design, alternatives considered, and why they were rejected.
4. **Affected modules** — Host, Client, docs, build/release.
5. **Contracts** — storage, HTTP, UI state, privacy. State “none” explicitly when nothing changed.
6. **Verification** — commands run and their results; manual checks for UI work.
7. **Risks and rollback** — what could break, and how to revert safely.
8. **Follow-ups** — deliberately deferred work.

## Lifecycle

```text
draft (while working)
→ implemented (verification passed, docs updated)
→ historical (kept as the record of that change)
```

- Update the record as the implementation changes; do not leave a stale design behind.
- A completed record is not archived. It stays under `docs/03-changes/` as history.
- Move a record to `docs/99-archive/` only when it is superseded or no longer describes the system.

## Bugfix Records

Use `docs/07-templates/bugfix-template.md`, or a short change record with the same headings.

A bugfix record must state:

- symptom
- root cause
- fix
- regression test
- affected module
- risk

A bugfix does not need a design document.

## Durable Decisions

When a choice should outlive the change — for example the ledger format, route style, or loading strategy — record it as an ADR under:

```text
docs/01-architecture/decisions/
```

ADRs are numbered and never rewritten; supersede them with a new ADR.

## Release

A change record does not authorize a release. Do not bump the version, tag, publish, or create a GitHub release until the user explicitly instructs it.

See `docs/06-operations/release-guide.md`.
