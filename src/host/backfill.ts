/**
 * Historical backfill over the Session persistence service.
 *
 * Live sessions feed the collector as they commit; this scan covers sessions
 * that existed before the plugin did — including the tail written while the
 * plugin was reloading. It is incremental: the ledger already tells us the
 * highest accepted seq per session, so only that tail is read. A session whose
 * stored `eventCount` is not ahead of that marker is skipped without opening it.
 *
 * The scan runs in the background with bounded concurrency and never blocks the
 * panel: reads are served from the live fold while it runs.
 */

import type { BackfillStatus } from './types.js'
import type { EventLike } from './usage.js'

/** The persistence snapshot fields this scan reads. */
export interface PersistenceSession {
  header: { id: string }
  eventCount?: number
}

/** A read handle; only `read(offset)`, `close()` and the inherited boundary are used. */
export interface PersistenceReadHandle {
  /** Number of leading events copied from a parent session (fork boundary). */
  inheritedEventCount?: number
  read(offset?: number): Promise<{ events: readonly EventLike[] }>
  close(): Promise<void>
}

/** The persistence subset this plugin depends on. */
export interface Persistence {
  list(): Promise<readonly PersistenceSession[]>
  open(id: string, access: 'read'): Promise<PersistenceReadHandle>
}

export interface BackfillOptions {
  persistence: Persistence
  lastSeqOf: (sessionId: string) => number
  onEvent: (sessionId: string, event: EventLike) => void
  concurrency?: number
  onChange?: (status: BackfillStatus) => void
  log?: (message: string) => void
  now?: () => number
}

/** One incremental historical scan. */
export class Backfill {
  private readonly options: BackfillOptions
  private running = false
  private status: BackfillStatus = {
    state: 'idle',
    sessions: 0,
    events: 0,
    skipped: 0,
    inherited: 0,
    startedAt: null,
    finishedAt: null,
    error: null,
  }

  constructor(options: BackfillOptions) {
    this.options = options
  }

  /** Current progress (a detached copy). */
  getStatus(): BackfillStatus {
    return { ...this.status }
  }

  private publish(patch: Partial<BackfillStatus>): void {
    this.status = { ...this.status, ...patch }
    this.options.onChange?.(this.getStatus())
  }

  /** Run one scan; concurrent calls are no-ops. */
  async run(): Promise<void> {
    if (this.running) return
    this.running = true
    const now = this.options.now ?? Date.now
    this.publish({ state: 'running', startedAt: now(), finishedAt: null, error: null, sessions: 0, events: 0, skipped: 0, inherited: 0 })

    try {
      const sessions = await this.options.persistence.list()
      let cursor = 0
      let events = 0
      while (cursor < sessions.length) {
        const batch = sessions.slice(cursor, cursor + 8)
        cursor += batch.length
        await Promise.all(batch.map((session) => this.scanOne(session)))
        events = this.status.events
        this.publish({ events })
      }
      this.publish({ state: 'done', events, finishedAt: now() })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.options.log?.(`historical scan failed: ${message}`)
      this.publish({ state: 'error', error: message, finishedAt: now() })
    } finally {
      this.running = false
    }
  }

  private async scanOne(session: PersistenceSession): Promise<void> {
    const sessionId = typeof session?.header?.id === 'string' ? session.header.id : ''
    if (sessionId === '') return
    const last = this.options.lastSeqOf(sessionId)
    const ahead = typeof session.eventCount === 'number' ? session.eventCount > last + 1 : true
    if (!ahead) {
      this.publish({ skipped: this.status.skipped + 1 })
      return
    }

    let handle: PersistenceReadHandle | undefined
    try {
      handle = await this.options.persistence.open(sessionId, 'read')
      // A fork copies its parent's events into its own log. Those events are
      // already accounted for in the parent, so the scan starts at the exact
      // inherited boundary instead of at event 0 — otherwise every fork would
      // double-count its ancestry.
      const inherited = Number.isSafeInteger(handle.inheritedEventCount) && (handle.inheritedEventCount ?? 0) > 0
        ? (handle.inheritedEventCount as number)
        : 0
      const offset = Math.max(last + 1, inherited)
      if (inherited > 0 && inherited > last + 1) this.publish({ inherited: this.status.inherited + 1 })
      const result = await handle.read(offset)
      for (const event of result.events) {
        if (Number.isFinite(event.seq) && event.seq < offset) continue
        this.options.onEvent(sessionId, event)
        this.publish({ events: this.status.events + 1 })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.options.log?.(`historical scan skipped ${sessionId}: ${message}`)
    } finally {
      if (handle !== undefined) {
        try {
          await handle.close()
        } catch {
          /* a handle that cannot close must not fail the scan */
        }
      }
    }
    this.publish({ sessions: this.status.sessions + 1 })
  }
}
