/**
 * The append-only JSONL ledger.
 *
 * One line per committed model call, written as the call commits. The format is
 * chosen for crash behaviour rather than for elegance: an interrupted append
 * costs at most one unreadable line, and the loader skips that line instead of
 * refusing the whole history.
 *
 * The ledger is the durable source of truth. The in-memory store is rebuilt from
 * it at activation, so a Host restart does not lose statistics.
 */

import { appendFile, mkdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

/**
 * Read and parse a ledger file.
 *
 * A missing file is an empty ledger, not an error: the first activation has
 * nothing to replay. Other read failures (permissions, a directory in the way)
 * propagate, because silently starting empty would look like lost history.
 *
 * @param {string} file - absolute ledger path.
 * @returns {Promise<{ records: Array<Record<string, unknown>>, bytes: number, lines: number, skipped: number }>} parsed records and file facts.
 */
export async function loadLedger(file) {
  let text
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return { records: [], bytes: 0, lines: 0, skipped: 0 }
    throw error
  }

  const records = []
  let lines = 0
  let skipped = 0
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue
    lines += 1
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        records.push(parsed)
      } else {
        skipped += 1
      }
    } catch {
      skipped += 1
    }
  }
  return { records, bytes: Buffer.byteLength(text), lines, skipped }
}

/**
 * Size of a ledger file in bytes, or 0 when it does not exist yet.
 *
 * @param {string} file - ledger path.
 * @returns {Promise<number>} byte size.
 */
export async function ledgerSize(file) {
  try {
    const info = await stat(file)
    return info.isFile() ? info.size : 0
  } catch (error) {
    if (error?.code === 'ENOENT') return 0
    throw error
  }
}

/**
 * Serialized appender: appends never interleave, and one failed write does not
 * stop later ones from being attempted.
 *
 * Writes are queued rather than awaited by the event listener. The session
 * event feed is fire-and-forget and a model call must not wait on this plugin's
 * disk I/O; `flush()` gives tests and shutdown a way to await the queue.
 */
export class LedgerWriter {
  /**
   * @param {string} file - absolute ledger path.
   * @param {{ onError?: (error: unknown) => void }} [options] - failure reporter.
   */
  constructor(file, { onError } = {}) {
    this.file = file
    this.onError = onError
    /** @type {Promise<unknown>} */
    this.queue = Promise.resolve()
    this.bytes = 0
    this.writes = 0
    /** @type {unknown} */
    this.error = undefined
  }

  /**
   * Queue one record.
   *
   * @param {unknown} record - canonical record.
   * @returns {Promise<boolean>} whether this append reached the file.
   */
  append(record) {
    let line
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

    this.queue = next.catch((error) => {
      this.error = error
      this.onError?.(error)
      return false
    })
    return this.queue
  }

  /**
   * Wait for every queued append.
   *
   * @returns {Promise<boolean>} whether every append so far succeeded.
   */
  async flush() {
    await this.queue
    return this.error === undefined
  }
}
