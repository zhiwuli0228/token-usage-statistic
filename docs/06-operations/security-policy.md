# Security Policy

## Credentials

- Resolve credentials only through `ctx.credentials` inside the Host.
- Never send tokens, API key values, authorization headers, or raw provider payloads to the Client.
- Never write credentials to `accounts.json`, exports, logs, or documentation.

## HTTP

- All routes are loopback-only.
- Non-loopback requests receive `403`.
- Only `GET` and `HEAD`.
- `cache-control: no-store`.
- Exact route registration only.

## Account Network

- HTTPS only; loopback may use HTTP.
- No redirects.
- 15-second timeout.
- 1 MiB response cap.
- Reject URLs with embedded credentials.

## Exports

- Allow-list fields only.
- No prompts, replies, file paths, or credentials.
- CSV formula-injection defense:
  - prefix `=`, `+`, `-`, `@` with an apostrophe
  - quote and escape cells
  - UTF-8 BOM + CRLF

## Local Data

- The ledger and caches are local files.
- The user can delete them at any time.
- No telemetry, analytics, or automatic upload.

## Logging

- Logs may contain file paths and coarse errors.
- Logs must not contain credentials or raw provider responses.

## Reporting

If you find a security issue, avoid posting secrets in a public issue. Describe the affected route or module and provide a redacted reproduction.
