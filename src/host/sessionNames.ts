/**
 * Friendly session and workspace names.
 *
 * DSH stores usage under opaque SessionIds.  This service maps those ids back
 * to the workspace title they live in and the session title (if one has been
 * generated or renamed) so the panel can show rows like
 * "My Workspace / First prompt summary" instead of a UUID.
 */

export interface WorkspaceLike {
  id: string
  title: string
  sessionIds: readonly string[]
}

export interface SessionQueryLike {
  readTitleSnapshots(sessionIds: readonly string[]): Promise<
    Array<{
      sessionId: string
      status: 'fulfilled' | 'rejected'
      value?: {
        session: { id: string }
        title?: { title: string }
      }
    }>
  >
}

export interface SessionNameResolver {
  get(sessionId: string): { name?: string; workspace?: string }
  refresh(sessionIds: string[]): Promise<void>
}

export interface SessionNameServiceConfig {
  workspaceRegistry?: { list(): WorkspaceLike[] }
  sessionQuery?: SessionQueryLike
  log?: (message: string) => void
}

/** Mutable cache of human-readable session metadata. */
export class SessionNameService implements SessionNameResolver {
  private workspaceRegistry?: SessionNameServiceConfig['workspaceRegistry']
  private sessionQuery?: SessionQueryLike
  private readonly log: (message: string) => void
  private readonly workspaceBySession = new Map<string, string>()
  private readonly nameBySession = new Map<string, string>()

  constructor(config: SessionNameServiceConfig = {}) {
    this.workspaceRegistry = config.workspaceRegistry
    this.sessionQuery = config.sessionQuery
    this.log = config.log ?? (() => {})
  }

  /** Late-binding helper: services may become available after activation. */
  setSources(config: Pick<SessionNameServiceConfig, 'workspaceRegistry' | 'sessionQuery'>): void {
    this.workspaceRegistry = config.workspaceRegistry
    this.sessionQuery = config.sessionQuery
  }

  /** Refresh workspace and title information for a set of session ids. */
  async refresh(sessionIds: string[]): Promise<void> {
    this.refreshWorkspaces()
    if (sessionIds.length === 0) return
    await this.refreshTitles(sessionIds)
  }

  private refreshWorkspaces(): void {
    if (this.workspaceRegistry === undefined) return
    try {
      for (const workspace of this.workspaceRegistry.list()) {
        for (const sessionId of workspace.sessionIds) {
          this.workspaceBySession.set(sessionId, workspace.title)
        }
      }
    } catch (error) {
      this.log(`workspace list failed: ${describeError(error)}`)
    }
  }

  private async refreshTitles(sessionIds: string[]): Promise<void> {
    if (this.sessionQuery === undefined) return
    try {
      const results = await this.sessionQuery.readTitleSnapshots(sessionIds)
      for (const result of results) {
        if (result.status !== 'fulfilled') continue
        const title = result.value?.title?.title
        if (typeof title === 'string' && title.length > 0) {
          this.nameBySession.set(result.sessionId, title)
        }
      }
    } catch (error) {
      this.log(`session title query failed: ${describeError(error)}`)
    }
  }

  get(sessionId: string): { name?: string; workspace?: string } {
    return {
      name: this.nameBySession.get(sessionId),
      workspace: this.workspaceBySession.get(sessionId),
    }
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
