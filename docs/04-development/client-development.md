# Client Development

## Entry and Slots

`src/client/index.ts` registers a factory with `window.__ModuleLoader__`.

`src/client/plugin.ts` injects:

- `sidebar.panellist` → sidebar row
- `main` (key `token-usage`) → panel page

Both use the same id so the layout dispatches the correct page.

## React

Do not import React. The shell supplies it through the loader's `require` seed.

`src/client/react.ts` binds the shell React and exposes `h()`, `useState`, `useEffect`, `useCallback`, `useRef`, and `useSyncExternalStore`.

No JSX is used. Build elements with `h(type, props, children)`.

## Panel

`src/client/panel.ts` is presentation-only:

- metrics
- provider/model tables
- daily chart
- day detail
- accounts
- export links

It reads only the Host's HTTP routes.

## Cache and Loading

`src/client/cache.ts`:

- `readCache` / `writeCache` with a 30-minute TTL
- `prefetchToday` at client activation
- `prefetchRanges` after the panel opens (7 and 30 days)

`useSummary` / `useDaily`:

- use the exact range cache if present
- otherwise use the widest shorter cache
- fetch only missing stages
- default range is Today

## i18n

Add keys to both `EN` and `ZH` dictionaries in `src/client/i18n.ts`.

Use `translate('key')` in components.

## Styling

Prefer `--dsw-alias-*` theme tokens. Avoid hard-coded brand colors.

## Verification

```bash
npm run typecheck
npm run test
npm run build
npm run test:bundle
```

The bundle smoke uses a fake React; add any new hook there if `react.ts` exposes it.
