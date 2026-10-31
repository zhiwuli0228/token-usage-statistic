/**
 * Browser entry: register a lazy factory with the shell's module loader.
 *
 * The factory receives the shell's shared `require` seed; React is resolved at
 * activation time rather than imported at build time, so no second React copy
 * enters the page.
 */

import { createClientModule } from './plugin.js'
import { bindReact, type ReactApi } from './react.js'

interface LoaderLike {
  load(definition: { id: string; factory(require: (name: string) => unknown): unknown }): void
}

const loader = (globalThis as { window?: { __ModuleLoader__?: LoaderLike } }).window?.__ModuleLoader__

if (loader !== undefined && typeof loader.load === 'function') {
  loader.load({
    id: 'token-usage-statistic',
    factory(require: (name: string) => unknown) {
      let React: ReactApi | null = null
      try {
        React = require('react') as ReactApi
      } catch {
        React = null
      }
      if (React === null || typeof React.createElement !== 'function') {
        return { name: 'token-usage-statistic', inject: [], apply() {} }
      }
      bindReact(React)
      return createClientModule()
    },
  })
}
