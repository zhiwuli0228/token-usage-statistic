# Pricing and Accounts

## Pricing

Every accepted sample is priced when it is folded, using the **event time** (`sample.time`), not the request time.

A rule matches by:

- route family (`deepseek` today)
- exact model id
- effective date range

DeepSeek rules support:

- flat prices
- peak / off-peak prices
- a schedule in an IANA time zone
- peak days and peak windows

Built-in aliases include:

```text
deepseek-flash → deepseek-v4-flash
deepseek-pro   → deepseek-v4-pro
```

`pricing.providers` determines which routes are considered priceable. Third-party gateways are unpriced by default.

### Fail-closed rule

If any counted sample in a total has no trustworthy price, or more than one currency is present:

```text
amount = null
complete = false
```

Tokens remain counted. The UI shows `—` and the unpriced call count.

## Accounts

Account sources are discovered from:

1. `deepseekAccount` Host service (DSH Desktop account).
2. `llm-deepseek` official API key (`GET /user/balance`).
3. `llm-pi-ai` providers matched by id or host to a built-in scheme.

Built-in schemes cover DeepSeek, Moonshot, Z.AI, OpenRouter, and OrcaRouter.

### Generic monitors

`accounts.monitors` can define a private endpoint:

```yaml
accounts:
  monitors:
    - id: coding-plan
      displayName: Coding Plan
      mode: subscription
      baseURL: https://billing.example.com/usage
      credentialRef: MY_PLAN_API_KEY
      subscription:
        plan: /plan/name
        windows: /data/windows
        fields:
          id: /key
          label: /label
          used: /used
          limit: /total
          remaining: /remaining
          unit: /unit
          resetAt: /reset_at
```

`mode: balance` maps amount/currency fields instead.

### Refresh behavior

- Background refresh defaults to 10 minutes.
- The panel's refresh button forces one refresh.
- `accounts.json` is written after each successful refresh.
- A stale cached snapshot is shown with a `stale` marker until the next success.

### Security boundary

- Credentials are resolved only through `ctx.credentials` inside the Host.
- Account requests are HTTPS-only (loopback may use HTTP).
- Redirects are not followed.
- Timeout: 15 seconds. Response cap: 1 MiB.
- URLs with embedded credentials are rejected.
- Responses, caches, and exports contain only normalized numbers and coarse error codes.
