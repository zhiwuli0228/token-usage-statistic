# Budget Rules

## Configuration

```yaml
budgets:
  currency: USD
  daily: 5
  monthly: 50
```

A missing or `null` limit disables that window.

## Window

A budget window contains:

```ts
{
  limit: number | null
  currency: string | null
  spend: number | null
  percent: number | null
  costComplete: boolean
  level: 'ok' | 'warn' | 'exceeded' | null
}
```

## Levels

- `ok`: below 80%
- `warn`: at least 80%
- `exceeded`: at least 100%

## Incomplete Cost

If any sample in the window is unpriced, or currencies are mixed:

```text
costComplete = false
spend = null
percent = null
level = null
```

The UI shows "cost incomplete" instead of a partial percentage. A partial sum must never be compared with the limit.

## Windows

- Daily: local calendar day.
- Monthly: local calendar month.

The budget uses the same cost estimates shown in the panel. It is not a provider invoice.

## Non-goals

- No automatic budget enforcement or request blocking.
- No notifications yet.
- No currency conversion.
