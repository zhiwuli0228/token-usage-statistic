/**
 * React access for the Client half.
 *
 * The browser shell owns one React instance and hands it to a plugin factory
 * through its `require` seed; this module is the single place that keeps that
 * instance so modules can build elements without importing React (which would
 * bundle a second copy).
 */

import type * as ReactNamespace from 'react'

/** The shell's React surface. */
export type ReactApi = typeof ReactNamespace

let api: ReactApi | null = null

/** Bind the shell's React before any component renders. */
export function bindReact(value: ReactApi): void {
  api = value
}

/** The bound React, or a loud failure instead of a blank slot. */
export function getReact(): ReactApi {
  if (api === null) throw new Error('[token-usage-statistic] React is not bound')
  return api
}

/** `React.createElement`, typed by React's own overloads. */
export const h = ((...args: unknown[]) => (getReact().createElement as (...input: unknown[]) => unknown)(...args)) as ReactApi['createElement']

/** `useState` through the bound React. */
export function useState<T>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void] {
  return getReact().useState(initial)
}

/** `useEffect` through the bound React. */
export function useEffect(effect: () => void | (() => void), dependencies?: readonly unknown[]): void {
  // React's dependency list is readonly in practice; the cast keeps callers
  // from having to spread a const tuple.
  ;(getReact().useEffect as (effect: () => void | (() => void), deps?: readonly unknown[]) => void)(effect, dependencies)
}

/** `useCallback` through the bound React. */
export function useCallback<T extends (...args: never[]) => unknown>(callback: T, dependencies: readonly unknown[]): T {
  return (getReact().useCallback as (callback: T, deps: readonly unknown[]) => T)(callback, dependencies)
}

/** `useSyncExternalStore` through the bound React. */
export function useSyncExternalStore<T>(
  subscribe: (onChange: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T,
): T {
  const react = getReact()
  const hook = react.useSyncExternalStore as unknown as (
    subscribe: (onChange: () => void) => () => void,
    getSnapshot: () => T,
    getServerSnapshot?: () => T,
  ) => T
  return hook(subscribe, getSnapshot, getServerSnapshot)
}
