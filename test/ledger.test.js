import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { LedgerWriter, ledgerSize, loadLedger } from '../src/host/ledger.js'
import { testRecord } from './helpers.js'

async function withTempDir(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'token-usage-'))
  try {
    return await run(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('a missing ledger is empty, not an error', async () => {
  await withTempDir(async (directory) => {
    const loaded = await loadLedger(path.join(directory, 'nope', 'usage.jsonl'))
    assert.deepEqual(loaded, { records: [], bytes: 0, lines: 0, skipped: 0 })
  })
})

test('append then load round-trips records', async () => {
  await withTempDir(async (directory) => {
    const file = path.join(directory, 'nested', 'usage.jsonl')
    const writer = new LedgerWriter(file)
    const first = testRecord({ sessionId: 's1', seq: 1 })
    const second = testRecord({ sessionId: 's1', seq: 2 })
    assert.equal(await writer.append(first), true)
    assert.equal(await writer.append(second), true)
    assert.equal(await writer.flush(), true)
    assert.equal(writer.writes, 2)

    const loaded = await loadLedger(file)
    assert.equal(loaded.lines, 2)
    assert.deepEqual(loaded.records, [first, second])
    assert.ok(loaded.bytes > 0)
    assert.equal(await ledgerSize(file), loaded.bytes)
  })
})

test('an interrupted line is skipped instead of failing the history', async () => {
  await withTempDir(async (directory) => {
    const file = path.join(directory, 'usage.jsonl')
    const record = testRecord()
    await writeFile(file, `${JSON.stringify(record)}\n{"broken":\n\nnot json\n`, 'utf8')

    const loaded = await loadLedger(file)
    assert.equal(loaded.records.length, 1)
    assert.equal(loaded.skipped, 2)
    assert.equal(loaded.lines, 3)
  })
})

test('non-object ledger lines are skipped', async () => {
  await withTempDir(async (directory) => {
    const file = path.join(directory, 'usage.jsonl')
    await writeFile(file, '[1,2,3]\nnull\n"text"\n', 'utf8')
    const loaded = await loadLedger(file)
    assert.equal(loaded.records.length, 0)
    assert.equal(loaded.skipped, 3)
  })
})

test('a failed append is reported without stopping later appends', async () => {
  await withTempDir(async (directory) => {
    const file = path.join(directory, 'usage.jsonl')
    const errors = []
    const writer = new LedgerWriter(file, { onError: (error) => errors.push(error) })
    const circular = {}
    circular.self = circular

    assert.equal(await writer.append(circular), false)
    assert.equal(errors.length, 1)
    assert.notEqual(writer.error, undefined)

    assert.equal(await writer.append(testRecord()), true)
    const loaded = await loadLedger(file)
    assert.equal(loaded.records.length, 1)
  })
})

test('appends never interleave', async () => {
  await withTempDir(async (directory) => {
    const file = path.join(directory, 'usage.jsonl')
    const writer = new LedgerWriter(file)
    const records = Array.from({ length: 25 }, (_, index) => testRecord({ sessionId: 's', seq: index }))
    await Promise.all(records.map((record) => writer.append(record)))
    await writer.flush()

    const text = await readFile(file, 'utf8')
    const lines = text.trim().split('\n')
    assert.equal(lines.length, 25)
    for (const line of lines) {
      assert.doesNotThrow(() => JSON.parse(line))
    }
  })
})
