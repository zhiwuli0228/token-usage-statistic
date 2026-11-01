# Usage Sample Model

## Event Sources

The collector observes three sources:

| Event | Role |
| --- | --- |
| `assistant/chunk` | streaming usage chunk (`data.chunk.type === 'usage'`) |
| `assistant/message` | committed assistant message with `usage` |
| `compaction/summary` | compaction usage |

## Sample Shape

```ts
interface UsageSample {
  version: 2
  sessionId: string
  seq: number
  time: number
  day: string          // local calendar key YYYY-MM-DD
  sampleKey: string    // turn:step or compaction:<id>
  kind: 'assistant' | 'compaction'
  provider: string
  model: string
  buckets: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
  }
}
```

## Sample Identity

- Assistant: `turn:step`
- Compaction: `compaction:<id>`

A later report for the same key replaces the earlier one. This is how a streaming chunk is upgraded to the committed message without double counting.

## Replacement Rules

- Key: `sessionId#sampleKey`.
- A sample with a lower `seq` than the stored one is ignored (stale historical scan).
- An exact duplicate is idempotent.
- Replacement subtracts the previous fold contribution, then adds the new one.

## Fork Boundary

A forked session inherits leading events from its parent. Backfill starts at:

```text
max(lastAcceptedSeq + 1, inheritedEventCount)
```

so ancestor events are not counted twice.

## Sanitization

- `seq`, `time`, and buckets must be finite non-negative numbers.
- Empty session ids and model ids are rejected.
- Unknown fields are ignored.
- v1 records without `sampleKey` migrate to `assistant:<seq>`.

## Route Fallback

If an event lacks a provider route, the collector falls back to the session's last known route. If no route exists, the sample is skipped rather than guessed.

## Token Buckets

- `input`
- `output`
- `cacheRead`
- `cacheWrite`

`tokens = input + output + cacheRead + cacheWrite`.

`cacheHitRate = cacheRead / (input + cacheRead)` when the denominator is non-zero, otherwise `null`.
