# Project Brief

## Project Name

token-usage-statistic

## Positioning

A DeepSeek Harness (DSH) plugin that records **local model usage** and estimates **cost by event time**, with provider balances, subscription quotas, budgets, and secret-free exports.

It works in DSH Desktop and DSH Web through the same Host plugin graph and the same Web client bundle.

## Core Value

The project turns:

```text
scattered session events + provider-reported usage + opaque session ids
```

into:

```text
replayable local ledger + daily/session/model views + cost estimates + budgets + exports
```

## Primary Users

- DSH Desktop users who want to know where their tokens go.
- DSH Web users running a local `dsh web` profile.
- Developers maintaining the plugin.
- Users who need a local, credential-free usage record for cost review.

## Main Workflows

### Workflow 1: Inspect Today

```text
open the sidebar entry
→ today's snapshot is shown first
→ inspect tokens, calls, cache hit rate, provider/model tables
→ open the daily chart and click a day
```

### Workflow 2: Widen the Window

```text
click 7 days / 30 days / all
→ cached windows are shown immediately
→ the exact range is refreshed in the background
→ metrics and chart update without a full-page loading state
```

### Workflow 3: Accounts and Budgets

```text
open the Accounts tab
→ see provider balances / quota windows / unsupported sources
→ configure budgets in the plugin config
→ budget bars show warn / exceeded / incomplete
```

### Workflow 4: Export

```text
open the Export tab
→ download daily CSV, sessions CSV, or versioned JSON
→ no prompts, replies, paths, or credentials are included
```

## Core Principles

- Local-first: usage data stays on the machine.
- Ledger-first: the JSONL ledger is replayable durable truth.
- Cost is derived: price rules can change and history can be repriced.
- Fail-closed: missing prices produce `null`, not a guessed amount.
- Credentials stay in the Host: `ctx.credentials` is used only inside the Host.
- Exact loopback HTTP routes: no `prefix` registration, no remote access.
- Host and Client are separate: the Client never reads the ledger directly.
- Progressive UI: today first, then wider windows.
- Release only on explicit user instruction.

## Non-goals

- Not a cloud billing or invoice reconciliation system.
- Not a prompt / response / conversation archive.
- Not a multi-tenant server or a shared team dashboard.
- Not a mandatory database or external analytics service.
- Not a replacement for provider invoices.
- Not a real-time alerting platform (budget notifications are not implemented).
