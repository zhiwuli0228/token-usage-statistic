import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { AccountRegistry, readMonitors, type AccountServices } from '../src/host/accounts/registry.js'
import { AccountError, fetchJson } from '../src/host/accounts/net.js'
import {
  parseGenericBalance,
  parseGenericSubscription,
  parseSchemeBalance,
  pointerValue,
  schemeForProvider,
  schemeURL,
} from '../src/host/accounts/schemes.js'

const directories: string[] = []

async function tempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'token-usage-accounts-'))
  directories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/** A fetch that dispatches on host and records the calls. */
function fakeFetch(routes: Record<string, () => Response | Promise<Response>>) {
  const calls: string[] = []
  const fetchImpl = async (url: string) => {
    calls.push(url)
    const host = new URL(url).host
    const route = routes[host]
    if (route === undefined) throw new Error(`unexpected host ${host}`)
    return route()
  }
  return { fetchImpl, calls }
}

describe('network safety', () => {
  it('refuses plain HTTP outside loopback', async () => {
    await expect(fetchJson('http://api.example.com/balance', {}, async () => json({}))).rejects.toMatchObject({ code: 'insecure-url' })
  })

  it('refuses embedded credentials', async () => {
    await expect(fetchJson('https://user:pass@api.example.com/balance', {}, async () => json({}))).rejects.toMatchObject({
      code: 'invalid-url',
    })
  })

  it('refuses to follow redirects', async () => {
    await expect(
      fetchJson('https://api.example.com/balance', {}, async () => new Response('', { status: 302, headers: { location: 'https://evil.example' } })),
    ).rejects.toMatchObject({ code: 'redirect' })
  })

  it('maps auth and rate-limit statuses', async () => {
    await expect(fetchJson('https://api.example.com/balance', {}, async () => json({}, 401))).rejects.toMatchObject({
      code: 'unauthorized',
    })
    await expect(fetchJson('https://api.example.com/balance', {}, async () => json({}, 429))).rejects.toMatchObject({
      code: 'rate-limited',
    })
  })

  it('caps the response size and rejects invalid JSON', async () => {
    await expect(
      fetchJson('https://api.example.com/balance', { maxBytes: 5 }, async () => json({ long: 'payload' })),
    ).rejects.toMatchObject({ code: 'too-large' })
    await expect(
      fetchJson('https://api.example.com/balance', {}, async () => new Response('not json', { status: 200 })),
    ).rejects.toMatchObject({ code: 'invalid-json' })
  })

  it('parses a JSON body', async () => {
    await expect(fetchJson('https://api.example.com/balance', {}, async () => json({ ok: true }))).resolves.toEqual({ ok: true })
  })
})

describe('schemes', () => {
  it('resolves JSON pointers', () => {
    const value = { data: { items: [{ balance: 3 }] } }
    expect(pointerValue(value, '/data/items/0/balance')).toBe(3)
    expect(pointerValue(value, '/data/missing')).toBeUndefined()
    expect(pointerValue(value, 'data.items')).toBeUndefined()
  })

  it('infers a scheme from provider id or host', () => {
    expect(schemeForProvider('deepseek', undefined)).toBe('deepseek')
    expect(schemeForProvider('x', 'https://api.deepseek.com')).toBe('deepseek')
    expect(schemeForProvider('moonshot', undefined)).toBe('moonshot')
    expect(schemeForProvider('zhipu', undefined)).toBe('zai')
    expect(schemeForProvider('x', 'https://api.z.ai/api/paas/v4')).toBe('zai')
    expect(schemeForProvider('x', 'https://openrouter.ai/api')).toBe('openrouter')
    expect(schemeForProvider('huawei', 'https://gateway.example.com/v1')).toBeNull()
  })

  it('builds scheme endpoints from the configured origin', () => {
    expect(schemeURL('deepseek', 'https://api.deepseek.com/v1')).toBe('https://api.deepseek.com/user/balance')
    expect(schemeURL('moonshot', 'https://api.moonshot.cn/v1')).toBe('https://api.moonshot.cn/v1/users/me/balance')
    expect(schemeURL('openrouter', 'https://openrouter.ai/api/v1')).toBe('https://openrouter.ai/api/v1/credits')
  })

  it('parses DeepSeek, Moonshot and OpenRouter balances', () => {
    expect(
      parseSchemeBalance('deepseek', {
        is_available: true,
        balance_infos: [{ currency: 'CNY', total_balance: '12.34', granted_balance: '2', topped_up_balance: '10.34' }],
      }),
    ).toMatchObject({ currency: 'CNY', total: 12.34, granted: 2, toppedUp: 10.34, available: true })

    expect(
      parseSchemeBalance('moonshot', { data: { available_balance: 5, cash_balance: 3, voucher_balance: 2, currency: 'CNY' } }),
    ).toMatchObject({ total: 5, granted: 2, toppedUp: 3 })

    expect(parseSchemeBalance('openrouter', { data: { total_credits: 10, total_usage: 4 } })).toMatchObject({
      total: 6,
      used: 4,
      limit: 10,
      currency: 'USD',
    })
  })

  it('fails closed on a response without numbers', () => {
    expect(() => parseSchemeBalance('deepseek', {})).toThrow(AccountError)
    expect(() => parseSchemeBalance('openrouter', { data: {} })).toThrow(AccountError)
  })

  it('applies generic balance and subscription mappings', () => {
    const balance = parseGenericBalance(
      { data: { wallet: { amount: '8.5', unit: 'USD' }, used: 1 } },
      { total: '/data/wallet/amount', currency: '/data/wallet/unit', used: '/data/used' },
    )
    expect(balance).toMatchObject({ total: 8.5, currency: 'USD', used: 1 })

    const subscription = parseGenericSubscription(
      { plan: 'pro', limits: [{ name: '5h', used: 3, total: 10, reset: '2026-11-01T00:00:00Z' }] },
      {
        plan: '/plan',
        windows: '/limits',
        fields: { id: '/name', label: '/name', used: '/used', limit: '/total', resetAt: '/reset' },
      },
    )
    expect(subscription.plan).toBe('pro')
    expect(subscription.windows[0]).toMatchObject({ id: '5h', used: 3, limit: 10, resetAt: '2026-11-01T00:00:00Z' })
  })
})

describe('account registry', () => {
  function services(overrides: Partial<Record<string, unknown>> = {}): AccountServices {
    const base: Record<string, unknown> = {
      settings: {
        describe: () => [
          {
            ns: 'include:llm-pi-ai',
            value: {
              providers: {
                huawei: { displayName: 'Huawei', baseURL: 'https://gateway.example.com/v1', apiKeyEnv: 'HUAWEI_API_KEY' },
                zai: { displayName: 'Z.ai', baseURL: 'https://api.z.ai/api/paas/v4', apiKeyEnv: 'ZAI_API_KEY' },
              },
            },
          },
          { ns: 'include:llm-deepseek', value: {} },
        ],
      },
      credentials: {
        describe: async (ref: string) => ({ configured: ref !== 'MISSING_KEY', writable: true }),
        resolve: async (ref: string) => (ref === 'MISSING_KEY' ? undefined : { value: `secret-${ref}`, source: 'env' }),
      },
      deepseekAccount: {
        getState: async () => ({ status: 'credential-stored' }),
        getBalance: async () => ({ status: 'ready', value: [{ currency: 'CNY', balance: '20' }], bonusWallets: [{ currency: 'CNY', balance: '5' }] }),
      },
      ...overrides,
    }
    return { get: (name: string) => base[name] }
  }

  it('discovers the host account, pi-ai providers, the DeepSeek API and config monitors', async () => {
    const directory = await tempDir()
    const { fetchImpl } = fakeFetch({
      'api.deepseek.com': () => json({ is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '9' }] }),
      'api.z.ai': () => json({ data: { total_balance: 7, currency: 'USD' } }),
      'billing.example.com': () => json({ data: { total: 3, currency: 'USD' } }),
    })
    const monitors = readMonitors([
      { id: 'custom', mode: 'balance', baseURL: 'https://billing.example.com/balance', credentialRef: 'CUSTOM_KEY', balance: { total: '/data/total', currency: '/data/currency' } },
    ])
    const instance = new AccountRegistry({
      services: services(),
      dataDir: directory,
      config: { refreshMs: 600000, timeoutMs: 15000, monitors },
      version: '0.2.0',
      fetchImpl,
    })

    await instance.refresh()
    const byId = new Map(instance.snapshot().accounts.map((account) => [account.id, account]))
    expect([...byId.keys()]).toEqual(['deepseek-account', 'huawei', 'zai', 'deepseek-api', 'custom'])
    expect(byId.get('deepseek-account')).toMatchObject({ status: 'ok', configured: true, balance: { currency: 'CNY', total: 25, granted: 5 } })
    expect(byId.get('huawei')).toMatchObject({ status: 'unsupported', configured: false })
    expect(byId.get('zai')).toMatchObject({ status: 'ok', balance: { total: 7 } })
    expect(byId.get('deepseek-api')).toMatchObject({ status: 'ok', balance: { total: 9 } })
    expect(byId.get('custom')).toMatchObject({ status: 'ok', balance: { total: 3 } })
  })

  it('reports a signed-out host account as unconfigured', async () => {
    const directory = await tempDir()
    const instance = new AccountRegistry({
      services: services({
        deepseekAccount: { getState: async () => ({ status: 'signed-out' }) },
      }),
      dataDir: directory,
      config: { refreshMs: 600000, timeoutMs: 15000, monitors: [] },
      version: '0.2.0',
      fetchImpl: fakeFetch({}).fetchImpl,
    })
    await instance.refresh()
    const account = instance.snapshot().accounts.find((entry) => entry.id === 'deepseek-account')
    expect(account).toMatchObject({ status: 'unconfigured', configured: false })
  })

  it('keeps one failed account from hiding the others', async () => {
    const directory = await tempDir()
    const logs: string[] = []
    const instance = new AccountRegistry({
      services: services(),
      dataDir: directory,
      config: { refreshMs: 600000, timeoutMs: 15000, monitors: [] },
      version: '0.2.0',
      fetchImpl: async (url: string) => {
        if (new URL(url).host === 'api.z.ai') throw new Error('upstream down')
        if (new URL(url).host === 'api.deepseek.com') return json({ is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1' }] })
        throw new Error('unexpected')
      },
      log: (message) => logs.push(message),
    })
    await instance.refresh()
    const byId = new Map(instance.snapshot().accounts.map((account) => [account.id, account]))
    expect(byId.get('zai')).toMatchObject({ status: 'error', lastError: 'account endpoint is unreachable' })
    expect(byId.get('deepseek-api')).toMatchObject({ status: 'ok' })
    expect(logs).toHaveLength(1)
  })

  it('marks a missing credential as unconfigured without a request', async () => {
    const directory = await tempDir()
    const { fetchImpl, calls } = fakeFetch({})
    const monitors = readMonitors([
      { id: 'locked', mode: 'balance', baseURL: 'https://locked.example.com/balance', credentialRef: 'MISSING_KEY', balance: { total: '/total' } },
    ])
    const instance = new AccountRegistry({
      services: services(),
      dataDir: directory,
      config: { refreshMs: 600000, timeoutMs: 15000, monitors },
      version: '0.2.0',
      fetchImpl,
    })
    await instance.refresh()
    const account = instance.snapshot().accounts.find((entry) => entry.id === 'locked')
    expect(account).toMatchObject({ status: 'unconfigured', configured: false })
    expect(calls.some((url) => url.includes('locked.example.com'))).toBe(false)
  })
})
