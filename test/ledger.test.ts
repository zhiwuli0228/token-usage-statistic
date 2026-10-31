import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { LedgerWriter, ledgerSize, loadLedger } from '../src/host/ledger.js'
import { makeSample } from './helpers.js'

const directories: string[] = []

async function tempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'token-usage-'))
  directories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('ledger', () => {
  it('treats a missing file as an empty ledger', async () => {
    const directory = await tempDir()
    expect(await loadLedger(path.join(directory, 'missing', 'usage.jsonl'))).toEqual({ records: [], bytes: 0, lines: 0, skipped: 0 })
  })

  it('round-trips appended samples', async () => {
    const directory = await tempDir()
    const file = path.join(directory, 'nested', 'usage.jsonl')
    const writer = new LedgerWriter(file)
    const first = makeSample({ seq: 1, sampleKey: '1:1' })
    const second = makeSample({ seq: 2, sampleKey: '1:2' })
    expect(await writer.append(first)).toBe(true)
    expect(await writer.append(second)).toBe(true)
    expect(await writer.flush()).toBe(true)

    const loaded = await loadLedger(file)
    expect(loaded.lines).toBe(2)
    expect(loaded.records).toEqual([first, second])
    expect(await ledgerSize(file)).toBe(loaded.bytes)
  })

  it('skips an interrupted or malformed line instead of failing the history', async () => {
    const directory = await tempDir()
    const file = path.join(directory, 'usage.jsonl')
    await writeFile(file, `${JSON.stringify(makeSample())}\n{"broken":\n\nnot json\n[1,2]\n`, 'utf8')
    const loaded = await loadLedger(file)
    expect(loaded.records).toHaveLength(1)
    expect(loaded.skipped).toBe(3)
    expect(loaded.lines).toBe(4)
  })

  it('reports a failed append without stopping later ones', async () => {
    const directory = await tempDir()
    const file = path.join(directory, 'usage.jsonl')
    const errors: unknown[] = []
    const writer = new LedgerWriter(file, { onError: (error) => errors.push(error) })
    const circular: Record<string, unknown> = {}
    circular.self = circular

    expect(await writer.append(circular)).toBe(false)
    expect(errors).toHaveLength(1)
    expect(await writer.append(makeSample())).toBe(true)
    expect((await loadLedger(file)).records).toHaveLength(1)
  })

  it('serializes concurrent appends without interleaving', async () => {
    const directory = await tempDir()
    const file = path.join(directory, 'usage.jsonl')
    const writer = new LedgerWriter(file)
    await Promise.all(Array.from({ length: 20 }, (_, index) => writer.append(makeSample({ seq: index, sampleKey: `1:${index}` }))))
    await writer.flush()

    const lines = (await readFile(file, 'utf8')).trim().split('\n')
    expect(lines).toHaveLength(20)
    for (const line of lines) expect(() => JSON.parse(line)).not.toThrow()
  })
})
