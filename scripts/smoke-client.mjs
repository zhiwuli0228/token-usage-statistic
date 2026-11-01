/**
 * Smoke-test the built Client bundle in a fake shell.
 *
 * The browser half is not type-checked against the live module loader, so this
 * script loads the shipped `client.js`, hands it a fake `window.__ModuleLoader__`
 * and a minimal React, and asserts the module registers both slots. It catches
 * bundling regressions (a stray import, a renamed export) that unit tests on
 * `src/` cannot see.
 */

import assert from 'node:assert/strict'

const definitions = []

const React = {
  createElement(type, props, ...children) {
    return { type, props: props ?? {}, children }
  },
  useState(initial) {
    return [initial, () => {}]
  },
  useRef(initial) {
    return { current: initial }
  },
  useEffect() {},
  useCallback(callback) {
    return callback
  },
  useSyncExternalStore() {
    return 0
  },
}

globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      definitions.push(definition)
    },
  },
}

await import(new URL('../client.js', import.meta.url))

assert.equal(definitions.length, 1, 'client bundle must register exactly one factory')
const definition = definitions[0]
assert.equal(definition.id, 'token-usage-statistic')
assert.equal(typeof definition.factory, 'function')

const client = definition.factory((name) => {
  assert.equal(name, 'react', `unexpected require seed: ${name}`)
  return React
})
assert.equal(client.name, 'token-usage-statistic')
assert.deepEqual(client.inject, ['slots', 'locale'])

const injections = []
const registrations = []
const ctx = {
  locale: {
    register() {
      return () => {}
    },
    bind() {
      return (key) => key
    },
    getLocale() {
      return { active: 'en' }
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
      injections.push(name)
      callback()
    },
    register(options, component) {
      registrations.push({ options, component })
      return () => {}
    },
  },
  effect(callback) {
    return callback()
  },
}

client.apply(ctx)
assert.deepEqual(injections, ['sidebar.panellist', 'main'])
assert.equal(registrations.length, 2)
const sidebar = registrations.find((entry) => entry.options.name === 'sidebar.panellist')
const main = registrations.find((entry) => entry.options.name === 'main')
assert.equal(sidebar.options.id, 'token-usage')
assert.equal(main.options.key, 'token-usage')

const icon = sidebar.component({ size: 24, active: true })
assert.equal(icon.type({ ...icon.props }).type, 'svg')

const page = main.component()
assert.equal(page.type({ ...page.props }).type, 'div')

console.log('client bundle smoke OK')
