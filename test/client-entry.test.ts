import { describe, expect, it } from 'vitest'

import { bindReact, type ReactApi } from '../src/client/react.js'

interface Definition {
  id: string
  factory(require: (name: string) => unknown): { name?: string; inject?: string[]; apply?: () => void }
}

const definitions: Definition[] = []

// The entry reads `window.__ModuleLoader__` at import time, so the fake shell
// must exist before the dynamic import below.
;(globalThis as { window?: unknown }).window = {
  __ModuleLoader__: {
    load(definition: Definition) {
      definitions.push(definition)
    },
  },
}

await import('../src/client/index.js')

const fakeReact = {
  createElement: (type: unknown, props: unknown) => ({ type, props }),
  useState: (initial: unknown) => [initial, () => {}],
  useEffect: () => {},
  useCallback: (callback: unknown) => callback,
  useSyncExternalStore: () => 0,
} as unknown as ReactApi

describe('browser entry', () => {
  it('registers one lazy factory under the package id', () => {
    expect(definitions).toHaveLength(1)
    expect(definitions[0]?.id).toBe('token-usage-statistic')
    expect(typeof definitions[0]?.factory).toBe('function')
  })

  it('builds the client module when the shell supplies React', () => {
    const module = definitions[0]!.factory((name) => {
      if (name === 'react') return fakeReact
      throw new Error(`unexpected require: ${name}`)
    })
    expect(module.name).toBe('token-usage-statistic')
    expect(module.inject).toEqual(['slots', 'locale'])
    expect(typeof module.apply).toBe('function')
  })

  it('stays inert when the shell has no React seed', () => {
    const module = definitions[0]!.factory(() => {
      throw new Error('react unavailable')
    })
    expect(module.name).toBe('token-usage-statistic')
    expect(module.inject).toEqual([])
    expect(() => module.apply?.()).not.toThrow()
  })

  it('binds React only after a successful seed', () => {
    const module = definitions[0]!.factory(() => fakeReact)
    expect(module).toBeDefined()
    bindReact(fakeReact)
  })
})
