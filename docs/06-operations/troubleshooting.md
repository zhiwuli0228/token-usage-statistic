# Troubleshooting

## Panel Returns 404

Check `activation.json` in the data directory:

- `route: "registered"` → route is registered.
- `route: "failed"` → read `error`.
- File missing → `webServer` was not injected.

Routes must be `kind: 'exact'`; `prefix` registrations are not dispatched.

## Panel 404 After a Code Change

The Host is still running the old bundle. Restart DSH Desktop (or the `dsh web` process).

## 7/30-Day Switch Is Slow

- Restart DSH Desktop after Host changes; the old Host may still await session-title lookup.
- Confirm the new Host returns `summary`/`daily` without blocking.
- Check whether the browser is using cached data and still refreshing.

## Panel Opens on Today

This is intentional. Today is the default. Widen the range manually.

## Accounts Show "No Public Interface"

The provider has no built-in scheme. Configure `accounts.monitors` with a private endpoint and JSON Pointer mapping.

## Accounts Show "Not Signed In / Not Configured"

Sign in to the DeepSeek account in DSH, or configure the provider credential, then refresh.

## Account Query Failed

The UI shows a coarse reason (timeout, 401, rate limit, invalid response). Credentials are never shown.

## Cost Shows "—"

At least one counted sample is unpriced, or currencies are mixed. Extend `pricing.providers`, `modelAliases`, or `pricing.rules`.

## Export Returns 403

The endpoints are loopback-only. Do not expose them through a reverse proxy.

## npm Publish Fails With 404/E404

- The package may not exist yet.
- Trusted publishing may not be configured.
- The tag may disagree with `package.json`.
- The workflow may be running with the wrong permissions.

## npm Shows the Old Version

Registry propagation can take 1–2 minutes. Re-check with `--prefer-online`.
