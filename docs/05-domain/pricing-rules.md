# Pricing Rules

## Matching

A sample is priced by:

- route family (`deepseek` today)
- exact model id
- event time within the rule's effective range

Pricing uses the sample's event time, not the request time.

## DeepSeek Schedule

Built-in peak windows use `Asia/Shanghai`:

```text
09:00–12:00
14:00–18:00
```

Outside those windows is off-peak. Rules may be flat or peak/off-peak.

## Aliases

Built-in aliases:

```text
deepseek-flash → deepseek-v4-flash
deepseek-pro   → deepseek-v4-pro
```

`modelAliases` can override or extend them.

## Priced Routes

Only routes listed in `pricing.providers` are considered priceable. The default set covers the official DeepSeek routes.

Third-party gateways are unpriced unless explicitly configured.

## Fail-closed

If a total contains:

- a sample with no matching rule, or
- more than one currency

then:

```text
amount = null
complete = false
```

The UI shows `—` and the unpriced call count. Tokens remain counted.

## Custom Rules

Add rules through `pricing.rules`:

```yaml
pricing:
  providers: [deepseek, deepseek-account]
  rules:
    - id: my-deepseek-rule
      providerFamily: deepseek
      model: deepseek-v4-flash
      currency: USD
      effectiveFrom: '2026-01-01'
      pricing:
        flat:
          input: 0.1
          output: 0.2
          cacheRead: 0.01
          cacheWrite: 0
      schedule: null
```

Prices are currency units per 1M tokens.

## Non-goals

- No provider invoice reconciliation.
- No automatic exchange-rate conversion.
- No guessed price for unknown models.
