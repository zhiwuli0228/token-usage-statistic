import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { PACKAGE } from '../src/host/index.js'
import { dataDirectory, defaultDataFile, resolveConfig } from '../src/host/config.js'

describe('data location', () => {
  it('lives under DSH_HOME when it is set', () => {
    expect(defaultDataFile({ DSH_HOME: 'C:\\dsh-home' }, 'C:\\Users\\me')).toBe(
      path.join('C:\\dsh-home', PACKAGE, 'usage.jsonl'),
    )
  })

  it('falls back to ~/.dsh', () => {
    expect(defaultDataFile({}, os.homedir())).toBe(path.join(os.homedir(), '.dsh', PACKAGE, 'usage.jsonl'))
  })

  it('keeps the receipt and ledger in one directory', () => {
    expect(dataDirectory({ DSH_HOME: 'C:\\dsh-home' }, 'C:\\Users\\me')).toBe(path.join('C:\\dsh-home', PACKAGE))
  })
})

describe('config', () => {
  it('applies defaults for a bare row', () => {
    expect(resolveConfig(undefined)).toMatchObject({
      dataFile: '',
      refreshMs: 15000,
      sessionLimit: 12,
      recentLimit: 200,
      backfill: true,
    })
  })

  it('keeps valid values and clamps the rest', () => {
    const resolved = resolveConfig({
      dataFile: '  E:\\data\\usage.jsonl  ',
      refreshMs: 60000,
      sessionLimit: 500,
      recentLimit: -1,
      backfill: false,
    })
    expect(resolved.dataFile).toBe('E:\\data\\usage.jsonl')
    expect(resolved.refreshMs).toBe(60000)
    expect(resolved.sessionLimit).toBe(100)
    expect(resolved.recentLimit).toBe(200)
    expect(resolved.backfill).toBe(false)
  })

  it('refuses a too-fast refresh interval', () => {
    expect(resolveConfig({ refreshMs: 100 }).refreshMs).toBe(15000)
    expect(resolveConfig({ refreshMs: 'soon' }).refreshMs).toBe(15000)
  })

  it('merges model aliases over the defaults', () => {
    const resolved = resolveConfig({ modelAliases: { 'my-flash': 'deepseek-v4-flash', broken: 42 } })
    expect(resolved.modelAliases['deepseek-flash']).toBe('deepseek-v4-flash')
    expect(resolved.modelAliases['my-flash']).toBe('deepseek-v4-flash')
    expect(resolved.modelAliases.broken).toBeUndefined()
  })

  it('accepts an explicit priced-provider list', () => {
    const resolved = resolveConfig({ pricing: { providers: ['my-gateway'] } })
    expect(resolved.pricedProviders).toEqual(['my-gateway'])
    expect(resolveConfig({}).pricedProviders).toContain('deepseek-account')
  })

  it('resolves account refresh, monitors and budgets', () => {
    const resolved = resolveConfig({
      accounts: {
        refreshMs: 120000,
        timeoutMs: 5000,
        monitors: [{ id: 'm', mode: 'balance', baseURL: 'https://billing.example.com/x', balance: { total: '/total' } }],
      },
      budgets: { currency: 'CNY', daily: 5 },
    })
    expect(resolved.accounts.refreshMs).toBe(120000)
    expect(resolved.accounts.timeoutMs).toBe(5000)
    expect(resolved.accounts.monitors).toHaveLength(1)
    expect(resolved.accounts.monitors[0]?.id).toBe('m')
    expect(resolved.budgets).toEqual({ currency: 'CNY', daily: 5, monthly: null })
  })

  it('clamps an account refresh below one minute', () => {
    expect(resolveConfig({ accounts: { refreshMs: 1000 } }).accounts.refreshMs).toBe(600000)
  })
})