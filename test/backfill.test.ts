import { describe, expect, it } from 'vitest'

import { Backfill, type Persistence, type PersistenceReadHandle } from '../src/host/backfill.js'
import type { EventLike } from '../src/host/usage.js'

interface Fixture {
  id: string
  eventCount?: number
  events: EventLike[]
  inherited?: number
  failOpen?: boolean
}

class FakePersistence implements Persistence {
  readonly reads: Array<{ id: string; offset: number }> = []
  private readonly fixtures: Fixture[]

  constructor(fixtures: Fixture[]) {
    this.fixtures = fixtures
  }

  async list() {
    return this.fixtures.map((fixture) => ({
      header: { id: fixture.id },
      eventCount: fixture.eventCount ?? fixture.events.length,
    }))
  }

  async open(id: string): Promise<PersistenceReadHandle> {
    const fixture = this.fixtures.find((entry) => entry.id === id)
    if (fixture === undefined || fixture.failOpen === true) throw new Error(`cannot open ${id}`)
    return {
      inheritedEventCount: fixture.inherited ?? 0,
      read: async (offset = 0) => {
        this.reads.push({ id, offset })
        return { events: fixture.events.slice(offset) }
      },
      close: async () => {},
    }
  }
}

function eventsOf(count: number): EventLike[] {
  return Array.from({ length: count }, (_, index) => ({
    type: 'assistant/message',
    seq: index,
    time: 1_800_000_000_000 + index,
    data: { turn: 1, step: index, usage: { inputTokens: 1, outputTokens: 1 } },
  }))
}

describe('historical backfill', () => {
  it('reads only the tail each session is missing', async () => {
    const persistence = new FakePersistence([
      { id: 'a', events: eventsOf(4) },
      { id: 'b', events: eventsOf(2) },
    ])
    const seen: Array<{ id: string; seq: number }> = []
    const lastSeq = new Map([['a', 1], ['b', 1]])
    const backfill = new Backfill({
      persistence,
      lastSeqOf: (id) => lastSeq.get(id) ?? -1,
      onEvent: (id, event) => seen.push({ id, seq: event.seq }),
    })

    await backfill.run()
    const status = backfill.getStatus()
    expect(status.state).toBe('done')
    expect(status.events).toBe(2)
    expect(status.skipped).toBe(1)
    expect(persistence.reads).toEqual([{ id: 'a', offset: 2 }])
    expect(seen.map((entry) => entry.seq)).toEqual([2, 3])
  })

  it('reads a session from the beginning when it is new', async () => {
    const persistence = new FakePersistence([{ id: 'fresh', events: eventsOf(3) }])
    const backfill = new Backfill({ persistence, lastSeqOf: () => -1, onEvent: () => {} })
    await backfill.run()
    expect(persistence.reads).toEqual([{ id: 'fresh', offset: 0 }])
    expect(backfill.getStatus().events).toBe(3)
  })

  it('starts a forked session at its inherited boundary', async () => {
    const persistence = new FakePersistence([{ id: 'fork', events: eventsOf(4), inherited: 2 }])
    const seen: number[] = []
    const backfill = new Backfill({
      persistence,
      lastSeqOf: () => -1,
      onEvent: (_id, event) => seen.push(event.seq),
    })
    await backfill.run()
    expect(persistence.reads).toEqual([{ id: 'fork', offset: 2 }])
    expect(seen).toEqual([2, 3])
    expect(backfill.getStatus().inherited).toBe(1)
  })

  it('keeps scanning when one session cannot be opened', async () => {
    const logs: string[] = []
    const persistence = new FakePersistence([
      { id: 'broken', events: eventsOf(1), failOpen: true },
      { id: 'good', events: eventsOf(2) },
    ])
    let seen = 0
    const backfill = new Backfill({
      persistence,
      lastSeqOf: () => -1,
      onEvent: () => {
        seen += 1
      },
      log: (message) => logs.push(message),
    })
    await backfill.run()
    expect(backfill.getStatus().state).toBe('done')
    expect(seen).toBe(2)
    expect(logs).toHaveLength(1)
  })

  it('does not run two scans concurrently', async () => {
    const persistence = new FakePersistence([{ id: 'a', events: eventsOf(1) }])
    let seen = 0
    const backfill = new Backfill({ persistence, lastSeqOf: () => -1, onEvent: () => (seen += 1) })
    await Promise.all([backfill.run(), backfill.run()])
    expect(seen).toBe(1)
  })
})
