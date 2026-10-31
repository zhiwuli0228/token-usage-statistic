import { describe, expect, it } from 'vitest'

import { createClientModule, type ClientContext } from '../src/client/plugin.js'
import { bindReact, type ReactApi } from '../src/client/react.js'

const fakeReact = {
  createElement(type: unknown, props: unknown, ...children: unknown[]) {
    return { type, props: (props ?? {}) as Record<string, unknown>, children }
  },
  useState(initial: unknown) {
    return [initial, () => {}]
  },
  useEffect() {},
  useCallback(callback: unknown) {
    return callback
  },
  useSyncExternalStore() {
    return 0
  },
} as unknown as ReactApi

bindReact(fakeReact)

interface Captured {
  injected: string[]
  registrations: Array<{ options: Record<string, any>; component: (props?: Record<string, unknown>) => any }>
  locales: Array<{ namespace: string; locale: string }>
  effects: number
}

function createContext(options: { failLocale?: boolean } = {}) {
  const captured: Captured = { injected: [], registrations: [], locales: [], effects: 0 }
  const locale = {
    register(namespace: string, id: string) {
      if (options.failLocale === true) throw new Error('locale refused')
      captured.locales.push({ namespace, locale: id })
      return () => {}
    },
    bind() {
      return (key: string) => `t:${key}`
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
  }
  const ctx: ClientContext = {
    locale,
    slots: {
      inject(key, callback) {
        captured.injected.push(key)
        callback()
      },
      register(options, component) {
        captured.registrations.push({ options: options as Record<string, any>, component })
        return () => {}
      },
    },
    effect(callback) {
      captured.effects += 1
      return callback()
    },
  }
  return { ctx, captured }
}

describe('client plugin', () => {
  it('declares the services it reads', () => {
    expect(createClientModule().inject).toEqual(['slots', 'locale'])
    expect(createClientModule().name).toBe('token-usage-statistic')
  })

  it('claims the sidebar row and the matching main panel', () => {
    const module = createClientModule()
    const { ctx, captured } = createContext()
    module.apply(ctx)

    expect(captured.injected).toEqual(['sidebar.panellist', 'main'])
    const sidebar = captured.registrations.find((entry) => entry.options.name === 'sidebar.panellist')
    const main = captured.registrations.find((entry) => entry.options.name === 'main')
    expect(sidebar?.options.id).toBe('token-usage')
    expect(sidebar?.options.order).toBe(45)
    expect(sidebar?.options.label()).toBe('t:title')
    expect(main?.options.key).toBe('token-usage')
  })

  it('registers both shipped locales', () => {
    const module = createClientModule()
    const { ctx, captured } = createContext()
    module.apply(ctx)
    expect(captured.locales.map((entry) => entry.locale)).toEqual(['en', 'zh', 'en-US', 'zh-CN'])
    expect(captured.locales.every((entry) => entry.namespace === 'token-usage-statistic')).toBe(true)
  })

  it('renders the sidebar glyph from owner props', () => {
    const module = createClientModule()
    const { ctx, captured } = createContext()
    module.apply(ctx)
    const sidebar = captured.registrations.find((entry) => entry.options.name === 'sidebar.panellist')!
    const element = sidebar.component({ size: 24, active: true })
    const icon = element.type(element.props)
    expect(icon.type).toBe('svg')
    expect(icon.props.width).toBe(24)
    expect(icon.props['aria-hidden']).toBe('true')
  })

  it('renders a first frame of the panel', () => {
    const module = createClientModule()
    const { ctx, captured } = createContext()
    module.apply(ctx)
    const main = captured.registrations.find((entry) => entry.options.name === 'main')!
    const element = main.component()
    const tree = element.type(element.props)
    expect(tree.type).toBe('div')
    expect(Array.isArray(tree.children)).toBe(true)
  })

  it('falls back to a local translator when locale registration is refused', () => {
    const module = createClientModule()
    const { ctx, captured } = createContext({ failLocale: true })
    module.apply(ctx)
    const sidebar = captured.registrations.find((entry) => entry.options.name === 'sidebar.panellist')!
    expect(sidebar.options.label()).toBe('模型用量统计')
  })
})
