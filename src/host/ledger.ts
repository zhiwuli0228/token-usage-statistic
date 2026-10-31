/**
 * The append-only JSONL ledger.
 *
 * One line per accepted sample. The format is chosen for crash behaviour: an
 * interrupted append costs at most one unreadable line, and the loader skips
 * that line instead of refusing the whole history. The fold is rebuilt from the
 * ledger at activation, so a Host restart does not lose statistics.
 */

import { appendFile, mkdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

export interface LedgerLoadResult {
  records: unknown[]
  bytes: number
  lines: number
  skipped: number
}

/** Read and parse a ledger file; a missing file is an empty ledger. */
export async function loadLedger(file: string): Promise<LedgerLoadResult> {
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
      return { records: [], bytes: 0, lines: 0, skipped: 0 }
    }
    throw error
  }

  const records: unknown[] = []
  let lines = 0
  let skipped = 0
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue
    lines += 1
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) records.push(parsed)
      else skipped += 1
    } catch {
      skipped += 1
    }
  }
  return { records, bytes: Buffer.byteLength(text), lines, skipped }
}

/** Byte size of a ledger file, or 0 when it does not exist yet. */
export async function ledgerSize(file: string): Promise<number> {
  try {
    const info = await stat(file)
    return info.isFile() ? info.size : 0
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') return 0
    throw error
  }
}

/**
 * Serialized appender: writes never interleave, and one failed write does not
 * stop later ones from being attempted.
 */
export class LedgerWriter {
  readonly file: string
  private queue: Promise<boolean> = Promise.resolve(true)
  private readonly onError?: (error: unknown) => void
  bytes = 0
  writes = 0
  error: unknown

  constructor(file: string, options: { onError?: (error: unknown) => void } = {}) {
    this.file = file
    this.onError = options.onError
  }

  /** Queue one sample. */
  append(record: unknown): Promise<boolean> {
    let line: string
    try {
      line = `${JSON.stringify(record)}\n`
    } catch (error) {
      this.error = error
      this.onError?.(error)
      return Promise.resolve(false)
    }

    const next = this.queue.then(async () => {
      await mkdir(path.dirname(this.file), { recursive: true })
      await appendFile(this.file, line, 'utf8')
      this.bytes += Buffer.byteLength(line)
      this.writes += 1
      return true
    })

    this.queue = next.catch((error: unknown) => {
      this.error = error
      this.onError?.(error)
      return false
    })
    return this.queue
  }

  /** Wait for every queued append; returns whether all succeeded. */
  async flush(): Promise<boolean> {
    await this.queue
    return this.error === undefined
  }
}
