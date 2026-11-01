# Privacy Boundary

## Data That Stays Local

- `usage.jsonl`
- `accounts.json`
- `activation.json`
- browser `localStorage` snapshots

## Data Never Collected

- prompts
- assistant replies
- tool arguments or results
- file contents
- file paths
- credentials
- raw provider responses

## Data Exposed to the Client

Only normalized usage, cost, budget, account status, and coarse errors.

Session titles and workspace names may be shown because they help identify a row. They are read from DSH services, not from prompts stored by this plugin.

## Network

- Account requests: HTTPS only (loopback may use HTTP), no redirects, 15s timeout, 1 MiB cap.
- No telemetry.
- No external analytics.
- No automatic upload.

## HTTP

- All routes are loopback-only.
- Non-loopback requests get `403`.
- Only `GET` and `HEAD`.
- `cache-control: no-store`.

## Exports

- Allow-list fields only.
- CSV formula-injection defense.
- No credentials or raw provider JSON.

## Logging

- Logs may contain file paths and coarse error messages.
- Logs must not contain credentials or raw provider payloads.

## User Control

The user can delete the cache files and the ledger at any time. The plugin does not upload or back up data on its own.
