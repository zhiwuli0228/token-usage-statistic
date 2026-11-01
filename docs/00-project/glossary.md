# Glossary

## DSH

DeepSeek Harness. The host application and Web UI that load this plugin.

## Host

The Node-side half of the plugin (`src/host`, bundled to `index.js`). It observes session events, prices usage, writes the ledger, queries accounts, and serves HTTP routes.

## Client

The browser-side half of the plugin (`src/client`, bundled to `client.js`). It registers the sidebar row and renders the panel. It reads only the Host's HTTP API.

## Bundle

A package that declares `dsh.bundle.patch` and can be installed by the DSH plugin manager. This repository is a bundle package.

## Slot

A named Client extension point. This plugin uses `sidebar.panellist` for the sidebar row and `main` (keyed by `token-usage`) for the page.

## Session Event

A durable event appended by DSH, such as `assistant/message`, `assistant/chunk`, or `compaction/summary`.

## Usage Sample

The normalized record this plugin extracts from a session event. It is keyed by `sessionId#sampleKey`.

## Sample Key

The identity of a provider call: `turn:step` for assistant calls, `compaction:<id>` for compaction summaries.

## Ledger

The append-only JSONL file at `usage.jsonl`. It is the replayable source of truth for usage.

## Fold

The in-memory derived view built by replaying the ledger: totals, provider/model rows, day folds, session folds, and recent samples.

## Route

The provider route reported by DSH, such as `deepseek-account` or `huawei`.

## Pricing Rule

A rule that maps a route family + model + event time to unit prices. Pricing is matched at replay time.

## Fail-closed Cost

A cost rendered as `null` when any counted sample has no trustworthy price. Tokens are still counted; money is not guessed.

## Backfill

The background scan of `sessionPersistence` that recovers historical usage.

## inheritedEventCount

The number of leading events inherited from a parent fork. Backfill starts after this boundary to avoid counting ancestor events twice.

## Account Monitor

A configured provider balance/quota endpoint and JSON Pointer mapping. It can override an auto-discovered account with the same id.

## Budget Window

A daily or monthly spend window. It tracks limit, spend, percentage, completeness, and level (`ok` / `warn` / `exceeded`).

## Progressive Hydration

The panel's staged loading model: today first, then 7 days, then 30 days, then all.

## Cache Phase

The client's indication of how much real data is currently shown: `today`, `partial`, or `full`.
