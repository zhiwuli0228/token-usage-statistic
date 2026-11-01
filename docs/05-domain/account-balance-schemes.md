# Account Balance Schemes

## Discovery Sources

1. `deepseekAccount` Host service (DSH Desktop account).
2. `llm-deepseek` official API key.
3. `llm-pi-ai` providers matched by id or host.

## Built-in Schemes

| Scheme | Source |
| --- | --- |
| `deepseek-account` | `deepseekAccount.getBalance()` |
| `deepseek-api` | `GET /user/balance` |
| `moonshot` | Moonshot balance endpoint |
| `zai` | Z.AI balance endpoint |
| `openrouter` | OpenRouter credits endpoint |
| `orcarouter` | OrcaRouter balance endpoint |

Unmatched providers are shown as `unsupported`; no guessed request is made.

## Account View

```ts
interface AccountView {
  id: string
  displayName: string
  source: string
  status: 'ok' | 'error' | 'unsupported' | 'unconfigured'
  stale: boolean
  balance?: AccountBalance
  subscription?: AccountSubscription
  lastError: string | null
  updatedAt: number | null
}
```

A balance may contain total, topped-up, granted, used, and limit amounts.

A subscription may contain a plan name and quota windows with used/limit/remaining/reset time.

## Generic Monitors

`accounts.monitors` supports:

- `mode: balance` — map amount/currency fields
- `mode: subscription` — map plan and `windows` array
- `baseURL` — full HTTPS URL (loopback may use HTTP)
- `credentialRef` — resolved only inside the Host
- JSON Pointer fields

Explicit monitors override an auto-discovered account with the same id.

## Refresh

- Default background refresh: 10 minutes.
- Manual `refresh=1` triggers a refresh.
- Last successful normalized result is cached in `accounts.json`.
- A stale cache is served with `stale: true` until the next success.

## Security

- No tokens, headers, API-key values, or raw JSON in responses/cache/exports.
- HTTPS only (loopback exception).
- No redirects.
- 15s timeout.
- 1 MiB response cap.
- URLs with embedded credentials are rejected.
