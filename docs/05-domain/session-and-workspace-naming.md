# Session and Workspace Naming

## Problem

Usage is stored by opaque `SessionId`. A row like `session-be17...` is not meaningful to a user.

## Sources

### Workspace

`workspaceRegistry.list()` returns workspaces with `title` and `sessionIds`. The plugin builds a `sessionId → workspace title` map.

Workspace lookup is synchronous and cheap.

### Session Title

`sessionQuery.readTitleSnapshots(sessionIds)` folds the latest log-backed title for each session.

Title lookup can be slow because it reads session logs. It must not block `summary` or `daily`.

## Refresh Policy

- Workspace map is rebuilt on each refresh.
- Title query has a 30-second TTL.
- Concurrent refreshes share one in-flight promise.
- Failures are logged and ignored; the next request retries.

## Display Fallback

If a session has:

- title + workspace → title, workspace, short id
- title only → title, short id
- workspace only → short id, workspace
- neither → short id

The short id is a middle-truncated form such as `session-be17…ad109a`.

## Contract

`SessionUsageView` carries:

```ts
name: string | null
workspace: string | null
```

Missing names are `null`, never an empty string.

## Non-blocking Rule

`GET /api/summary` and `GET /api/daily` call `sessionNames.refresh(...)` without awaiting it. They respond with the current cache.
