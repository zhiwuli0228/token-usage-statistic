/**
 * Client-half smoke tests without a browser.
 *
 * `client.js` registers itself through `window.__ModuleLoader__` and expects the
 * shared React seed, so this file supplies both before importing it. The React
 * stub is intentionally minimal: it lets `apply()` and a first render pass run
 * so wiring mistakes fail here instead of as a blank slot in the page.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

const loaded = []

globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      loaded.push(definition)
    },
  },
}

const ReactStub = {
  createElement(type, props, ...children) {
    return { type, props: props ?? {}, children }
  },
  useState(initial) {
    return [initial, () => {}]
  },
  useEffect() {},
  useCallback(callback) {
    return callback
  },
  useSyncExternalStore() {
    return 0
  },
}

function requireStub(name) {
  if (name === 'react') return ReactStub
  throw new Error(`unexpected require: ${name}`)
}

await import('../client.js')

function createContext({ failLocale = false } = {}) {
  const state = { injected: [], registrations: [], effects: [], locales: [] }
  const ctx = {
    locale: {
      register(namespace, locale) {
        if (failLocale) throw new Error('locale registration refused')
        state.locales.push({ namespace, locale })
        return () => {}
      },
      bind() {
        return (key) => `translated:${key}`
      },
      getLocale() {
        return { active: 'zh' }
      },
      getSnapshot() {
        return { revision: 1 }
      },
      subscribe() {
        return () => {}
      },
    },
    slots: {
      inject(name, callback) {
        state.injected.push(name)
        callback()
      },
      register(options, component) {
        state.registrations.push({ options, component })
      },
    },
    effect(callback) {
      state.effects.push(callback)
    },
  }
  return { ctx, state }
}

test('the module registers exactly one lazy factory', () => {
  assert.equal(loaded.length, 1)
  assert.equal(loaded[0].id, 'token-usage-statistic')
  assert.equal(typeof loaded[0].factory, 'function')
})

test('apply claims both root slots, with one shared id', () => {
  const module = loaded[0].factory(requireStub)
  assert.deepEqual(module.inject, ['slots', 'locale'])
  assert.equal(module.name, 'token-usage-statistic')

  const { ctx, state } = createContext()
  module.apply(ctx)

  assert.deepEqual(state.injected, ['sidebar.panellist', 'main'])

  const sidebar = state.registrations.find((entry) => entry.options.name === 'sidebar.panellist')
  const main = state.registrations.find((entry) => entry.options.name === 'main')
  assert.ok(sidebar, 'sidebar row registered')
  assert.ok(main, 'main panel registered')
  assert.equal(sidebar.options.id, 'token-usage')
  assert.equal(main.options.key, 'token-usage')
  assert.equal(sidebar.options.order, 45)
  assert.equal(typeof sidebar.options.label, 'function')
  assert.equal(sidebar.options.label(), 'translated:title')
})

test('locale dictionaries cover both shipped languages', () => {
  const module = loaded[0].factory(requireStub)
  const { ctx, state } = createContext()
  module.apply(ctx)

  const ids = state.locales.map((entry) => entry.locale)
  assert.ok(ids.includes('en'))
  assert.ok(ids.includes('zh'))
  for (const entry of state.locales) assert.equal(entry.namespace, 'token-usage-statistic')
})

test('the sidebar glyph renders from the owner props', () => {
  const module = loaded[0].factory(requireStub)
  const { ctx, state } = createContext()
  module.apply(ctx)

  const sidebar = state.registrations.find((entry) => entry.options.name === 'sidebar.panellist')
  const element = sidebar.component({ size: 24, active: true })
  assert.equal(typeof element.type, 'function')
  const icon = element.type(element.props)
  assert.equal(icon.type, 'svg')
  assert.equal(icon.props.width, 24)
  assert.equal(icon.props.height, 24)
  assert.equal(icon.props['aria-hidden'], 'true')
})

test('the panel renders its first frame without throwing', () => {
  const module = loaded[0].factory(requireStub)
  const { ctx, state } = createContext()
  module.apply(ctx)

  const main = state.registrations.find((entry) => entry.options.name === 'main')
  const element = main.component()
  assert.equal(typeof element.type, 'function')

  const tree = element.type(element.props)
  assert.equal(tree.type, 'div')
  assert.ok(Array.isArray(tree.children))
})

test('a refused locale registration still leaves the panel reachable', () => {
  const module = loaded[0].factory(requireStub)
  const { ctx, state } = createContext({ failLocale: true })
  module.apply(ctx)

  assert.deepEqual(state.injected, ['sidebar.panellist', 'main'])
  const sidebar = state.registrations.find((entry) => entry.options.name === 'sidebar.panellist')
  assert.equal(sidebar.options.label(), '模型用量统计')
})

test('a shell without React yields an inert module instead of a crash', () => {
  const inert = loaded[0].factory(() => {
    throw new Error('react unavailable')
  })
  assert.equal(inert.name, 'token-usage-statistic')
  assert.deepEqual(inert.inject, [])
  assert.equal(typeof inert.apply, 'function')
  assert.doesNotThrow(() => inert.apply())
})
