import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { PACKAGE, defaultDataFile, resolveConfig } from '../index.js'

test('the data file lives under DSH_HOME when it is set', () => {
  const file = defaultDataFile({ DSH_HOME: 'C:\\dsh-home' }, 'C:\\Users\\me')
  assert.equal(file, path.join('C:\\dsh-home', PACKAGE, 'usage.jsonl'))
})

test('the data file falls back to ~/.dsh', () => {
  const file = defaultDataFile({}, os.homedir())
  assert.equal(file, path.join(os.homedir(), '.dsh', PACKAGE, 'usage.jsonl'))
})

test('resolveConfig applies defaults for an empty row', () => {
  assert.deepEqual(resolveConfig(undefined), {
    dataFile: '',
    refreshMs: 15000,
    sessionLimit: 12,
    recentLimit: 200,
  })
  assert.deepEqual(resolveConfig({}), resolveConfig(undefined))
})

test('resolveConfig keeps valid values and clamps the rest', () => {
  const resolved = resolveConfig({
    dataFile: '  E:\\data\\usage.jsonl  ',
    refreshMs: 60000,
    sessionLimit: 500,
    recentLimit: -1,
  })
  assert.equal(resolved.dataFile, 'E:\\data\\usage.jsonl')
  assert.equal(resolved.refreshMs, 60000)
  assert.equal(resolved.sessionLimit, 100)
  assert.equal(resolved.recentLimit, 200)
})

test('resolveConfig refuses a too-fast refresh interval', () => {
  assert.equal(resolveConfig({ refreshMs: 100 }).refreshMs, 15000)
  assert.equal(resolveConfig({ refreshMs: 'soon' }).refreshMs, 15000)
})
