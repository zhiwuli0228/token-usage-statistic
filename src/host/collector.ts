/**
 * Session-event reader.
 *
 * The collector remembers each session's last `request/header` route as a
 * fallback attribution and turns every usage-bearing event into one canonical
 * sample. All state is per session id because one Host process serves many
 * sessions concurrently.
 */

import type { SampleKind, UsageSample } from './types.js'
import { makeSample, routeOf, sampleDraftOf, type EventLike, type RouteIdentity } from './usage.js'

/** A session-like object; only `id` is read. */
export interface SessionLike {
  id?: string
}

/** One accepted sample plus the session it belongs to. */
export interface CollectedSample {
  sample: UsageSample
}

export class Collector {
  private readonly routes = new Map<string, RouteIdentity>()
  private readonly maxSessions: number

  constructor(options: { maxSessions?: number } = {}) {
    const max = options.maxSessions ?? 512
    this.maxSessions = Number.isFinite(max) && max > 0 ? Math.floor(max) : 512
  }

  /** Remember one session's effective request route. */
  remember(sessionId: string, route: RouteIdentity): void {
    if (route.model === '' || route.model === 'unknown') return
    if (!this.routes.has(sessionId) && this.routes.size >= this.maxSessions) {
      const oldest = this.routes.keys().next().value
      if (oldest !== undefined) this.routes.delete(oldest)
    }
    this.routes.set(sessionId, route)
  }

  /** Forget one session's fallback route. */
  forget(sessionId: string | undefined): void {
    if (typeof sessionId === 'string') this.routes.delete(sessionId)
  }

  /** Turn one committed session event into a sample, if it carries usage. */
  observe(session: SessionLike | undefined, event: EventLike | undefined): CollectedSample | null {
    const sessionId = session !== undefined && typeof session.id === 'string' ? session.id : ''
    if (sessionId === '' || event === undefined) return null

    if (event.type === 'request/header') {
      const route = routeOf(event)
      if (route !== null) this.remember(sessionId, route)
      return null
    }

    const draft = sampleDraftOf(event)
    if (draft === null) return null

    const named = routeOf(event)
    if (named !== null) this.remember(sessionId, named)
    const route = named ?? this.routes.get(sessionId) ?? { provider: 'unknown', model: 'unknown' }
    const kind: SampleKind = draft.kind

    const sample = makeSample({
      sessionId,
      seq: event.seq,
      time: event.time,
      key: draft.key,
      kind,
      provider: route.provider,
      model: route.model,
      usage: draft.usage,
    })
    return sample === null ? null : { sample }
  }
}
