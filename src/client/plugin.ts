/**
 * Client plugin wiring.
 *
 * Two root-scoped slots must agree on one id: `sidebar.panellist` renders the
 * row and `main` renders the page the layout dispatches for that id.
 */

import type { LocaleLike } from './i18n.js'
import { installLocale } from './i18n.js'
import { Panel } from './panel.js'
import { h } from './react.js'

const PANEL_ID = 'token-usage'
const ORDER = 45

/** The slot service subset this plugin uses. */
interface SlotsLike {
  inject(key: string, callback: () => unknown): unknown
  register(options: Record<string, unknown>, component: (props?: Record<string, unknown>) => unknown): unknown
}

/** The Client context subset this plugin uses. */
export interface ClientContext {
  slots: SlotsLike
  locale: LocaleLike
  effect(callback: () => (() => void) | void): unknown
}

export interface ClientModule {
  name: string
  inject: string[]
  apply(ctx: ClientContext): void
}

/** Sidebar glyph: a panel outline with three usage bars, painted by `currentColor`. */
function PanelIcon(props: { size?: number; active?: boolean }) {
  const edge = typeof props.size === 'number' && Number.isFinite(props.size) && props.size > 0 ? props.size : 20
  return h(
    'svg',
    {
      width: edge,
      height: edge,
      viewBox: '0 0 20 20',
      fill: 'none',
      'aria-hidden': 'true',
      style: { display: 'block', opacity: props.active === false ? 0.72 : 1 },
    },
    [
      h('rect', {
        key: 'frame',
        x: 2.4,
        y: 3.2,
        width: 15.2,
        height: 13.6,
        rx: 3.2,
        stroke: 'currentColor',
        strokeWidth: 1.3,
      }),
      h('path', {
        key: 'bars',
        d: 'M6.4 13.2V9.6M10 13.2V6.8M13.6 13.2V8.4',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
      }),
    ],
  )
}

/** Build the module the shell's loader expects. */
export function createClientModule(): ClientModule {
  return {
    name: 'token-usage-statistic',
    inject: ['slots', 'locale'],
    apply(ctx: ClientContext): void {
      const installation = installLocale(ctx.locale, (message) => {
        try {
          console.warn('[token-usage-statistic]', message)
        } catch {
          /* logging must not break activation */
        }
      })
      ctx.effect(() => () => installation.dispose())

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: ORDER,
            label: () => installation.translate('title'),
          },
          (props) => h(PanelIcon, (props ?? {}) as { size?: number; active?: boolean }),
        ),
      )

      ctx.slots.inject('main', () =>
        ctx.slots.register(
          { name: 'main', key: PANEL_ID, inject: () => ({}) },
          () => h(Panel, { translate: installation.translate, locale: ctx.locale }),
        ),
      )
    },
  }
}
