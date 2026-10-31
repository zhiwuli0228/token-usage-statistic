/**
 * The statistics panel.
 *
 * Presentation only: the Host owns aggregation, history and pricing, and this
 * file renders the snapshot it serves. Components are built with `h()` so the
 * bundle never imports React at build time — the shell supplies it at runtime.
 */

import type { ReactNode } from 'react'
import type {
  CostRender,
  DayUsageView,
  ModelUsageView,
  ProviderUsageView,
  SessionUsageView,
  UsageSnapshot,
} from '../host/types.js'
import { formatClock, formatCompact, formatCost, formatDateTime, formatInteger, formatPercent, shortSessionId } from './format.js'
import type { LocaleLike, Translate } from './i18n.js'
import { h, useCallback, useEffect, useState, useSyncExternalStore } from './react.js'

const SUMMARY_URL = '/token-usage-statistic/api/summary'
const DEFAULT_REFRESH_MS = 15000

/** Selectable trailing window; `all` means everything. */
type SummaryRange = '1' | '7' | '30' | 'all'

const RANGES: SummaryRange[] = ['1', '7', '30', 'all']

const styles: Record<string, Record<string, string | number>> = {
  page: {
    boxSizing: 'border-box',
    height: '100%',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '18px',
    padding: '0 clamp(20px, 4vw, 44px) 40px',
    color: 'var(--dsw-alias-label-primary, inherit)',
  },
  head: {
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '960px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    paddingTop: 'calc(28px + var(--dsh-frame-top-clearance, 0px))',
  },
  title: { margin: 0, fontSize: '20px', fontWeight: 500, lineHeight: '28px' },
  subtitle: { margin: '4px 0 0', fontSize: '13px', lineHeight: '20px', color: 'var(--dsw-alias-label-secondary, inherit)' },
  headSide: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 },
  pill: {
    fontSize: '11px',
    color: 'var(--dsw-alias-label-secondary, inherit)',
    border: '0.5px solid var(--dsw-alias-border-l1, #e2e2e2)',
    borderRadius: '999px',
    padding: '2px 8px',
    whiteSpace: 'nowrap',
  },
  toolbar: {
    width: '100%',
    maxWidth: '960px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  segmented: {
    display: 'inline-flex',
    gap: '2px',
    padding: '2px',
    borderRadius: '10px',
    border: '0.5px solid var(--dsw-alias-border-l1, #e2e2e2)',
  },
  segment: {
    font: 'inherit',
    fontSize: '12px',
    lineHeight: '20px',
    padding: '2px 10px',
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    color: 'var(--dsw-alias-label-secondary, inherit)',
    cursor: 'pointer',
  },
  segmentActive: {
    background: 'var(--dsw-alias-bg-layer-2, rgba(0,0,0,0.06))',
    color: 'var(--dsw-alias-label-primary, inherit)',
    fontWeight: 500,
  },
  ghostButton: {
    font: 'inherit',
    fontSize: '12px',
    lineHeight: '20px',
    padding: '3px 12px',
    borderRadius: '999px',
    border: '0.5px solid var(--dsw-alias-border-l1, #e2e2e2)',
    background: 'transparent',
    color: 'var(--dsw-alias-label-primary, inherit)',
    cursor: 'pointer',
  },
  metrics: {
    width: '100%',
    maxWidth: '960px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '10px',
  },
  metric: {
    boxSizing: 'border-box',
    border: '0.5px solid var(--dsw-alias-border-l1, #e2e2e2)',
    borderRadius: '14px',
    background: 'var(--dsw-alias-bg-layer-1, transparent)',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  },
  metricLabel: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary, inherit)' },
  metricValue: { fontSize: '20px', fontWeight: 600, lineHeight: '26px', fontVariantNumeric: 'tabular-nums' },
  metricNote: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary, inherit)' },
  notice: {
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '960px',
    border: '0.5px solid var(--dsw-alias-border-l1, #e2e2e2)',
    borderRadius: '12px',
    padding: '9px 14px',
    fontSize: '12px',
    color: 'var(--dsw-alias-label-secondary, inherit)',
    background: 'var(--dsw-alias-bg-layer-1, transparent)',
  },
  noticeError: {
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '960px',
    border: '0.5px solid var(--dsw-alias-state-error-primary, #d33)',
    borderRadius: '12px',
    padding: '9px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    fontSize: '13px',
  },
  section: {
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '960px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionTitle: { margin: 0, fontSize: '13px', fontWeight: 500 },
  tableWrap: {
    overflowX: 'auto',
    border: '0.5px solid var(--dsw-alias-border-l1, #e2e2e2)',
    borderRadius: '14px',
    background: 'var(--dsw-alias-bg-layer-1, transparent)',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    fontSize: '11px',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--dsw-alias-label-secondary, inherit)',
    padding: '8px 12px',
    borderBottom: '0.5px solid var(--dsw-alias-border-l1, #e2e2e2)',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '7px 12px',
    borderBottom: '0.5px solid var(--dsw-alias-border-l1, #e2e2e2)',
    verticalAlign: 'middle',
    fontVariantNumeric: 'tabular-nums',
  },
  cellStrong: { fontWeight: 500 },
  cellMuted: { color: 'var(--dsw-alias-label-secondary, inherit)', fontSize: '12px' },
  hint: { margin: 0, fontSize: '13px', color: 'var(--dsw-alias-label-secondary, inherit)' },
  empty: {
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '960px',
    border: '0.5px solid var(--dsw-alias-border-l1, #e2e2e2)',
    borderRadius: '14px',
    background: 'var(--dsw-alias-bg-layer-1, transparent)',
    padding: '32px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    textAlign: 'center',
  },
  emptyTitle: { margin: 0, fontSize: '14px', fontWeight: 500 },
  footer: {
    width: '100%',
    maxWidth: '960px',
    margin: '0 0 8px',
    fontSize: '11px',
    lineHeight: '18px',
    color: 'var(--dsw-alias-label-secondary, inherit)',
  },
  providerCard: {
    boxSizing: 'border-box',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    border: '0.5px solid var(--dsw-alias-border-l1, #e2e2e2)',
    borderRadius: '14px',
    background: 'var(--dsw-alias-bg-layer-1, transparent)',
    padding: '10px 12px',
  },
  providerHead: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '12px',
  },
  providerName: { fontSize: '13px', fontWeight: 500 },
  providerStats: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary, inherit)', fontVariantNumeric: 'tabular-nums' },
}

interface Column<T> {
  key: string
  label: string
  align?: 'left' | 'right'
  render?: (row: T) => ReactNode
}

/** A small themed table. */
function DataTable<T>(props: { columns: Column<T>[]; rows: T[]; empty: string; rowKey: (row: T, index: number) => string }) {
  if (props.rows.length === 0) return h('p', { style: styles.hint }, props.empty)
  return h(
    'div',
    { style: styles.tableWrap },
    h('table', { style: styles.table }, [
      h(
        'thead',
        { key: 'head' },
        h(
          'tr',
          null,
          props.columns.map((column) =>
            h('th', { key: column.key, style: { ...styles.th, textAlign: column.align ?? 'left' } }, column.label),
          ),
        ),
      ),
      h(
        'tbody',
        { key: 'body' },
        props.rows.map((row, index) =>
          h(
            'tr',
            { key: props.rowKey(row, index) },
            props.columns.map((column) =>
              h(
                'td',
                { key: column.key, style: { ...styles.td, textAlign: column.align ?? 'left' } },
                column.render === undefined
                  ? ((row as Record<string, unknown>)[column.key] as ReactNode)
                  : column.render(row),
              ),
            ),
          ),
        ),
      ),
    ]),
  )
}

/** One metric card. */
function Metric(props: { label: string; value: string; note?: string; title?: string }) {
  return h('div', { style: styles.metric, title: props.title }, [
    h('span', { key: 'label', style: styles.metricLabel }, props.label),
    h('span', { key: 'value', style: styles.metricValue }, props.value),
    props.note === undefined ? null : h('span', { key: 'note', style: styles.metricNote }, props.note),
  ])
}

/** Exact value in a numeric cell, grouped text on screen. */
function numeric(value: number) {
  return h('span', { title: formatInteger(value) }, formatInteger(value))
}

/** Re-render when the active locale or any dictionary changes. */
function useLocaleRevision(locale: LocaleLike): number {
  return useSyncExternalStore(
    useCallback((onChange: () => void) => locale.subscribe(onChange), [locale]),
    useCallback(() => locale.getSnapshot().revision, [locale]),
    useCallback(() => 0, []),
  )
}

interface SummaryState {
  data: UsageSnapshot | null
  error: string | null
  loading: boolean
  refresh: () => void
}

/** Read the Host snapshot with polling and a manual refresh. */
function useSummary(range: SummaryRange): SummaryState {
  const [data, setData] = useState<UsageSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  const configured = data?.config?.refreshMs
  const refreshMs = typeof configured === 'number' && Number.isFinite(configured) ? Math.max(3000, configured) : DEFAULT_REFRESH_MS

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const load = async (): Promise<void> => {
      try {
        const response = await fetch(`${SUMMARY_URL}?days=${encodeURIComponent(range)}&recent=20`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = (await response.json()) as UsageSnapshot
        if (cancelled) return
        setData(payload)
        setError(null)
      } catch (cause) {
        if (cancelled) return
        if (cause !== null && typeof cause === 'object' && (cause as { name?: string }).name === 'AbortError') return
        setError(cause instanceof Error ? cause.message : String(cause))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    setLoading(true)
    void load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [range, nonce])

  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      setNonce((value) => value + 1)
    }, refreshMs)
    return () => clearInterval(timer)
  }, [refreshMs])

  const refresh = useCallback(() => setNonce((value) => value + 1), [])
  return { data, error, loading, refresh }
}

function rangeLabel(range: SummaryRange, translate: Translate): string {
  if (range === '1') return translate('rangeToday')
  if (range === '7') return translate('range7')
  if (range === '30') return translate('range30')
  return translate('rangeAll')
}

/** Model table columns, shared by every provider card. */
function modelColumns(translate: Translate): Column<ModelUsageView>[] {
  return [
    { key: 'model', label: translate('model'), render: (row) => h('span', { style: styles.cellStrong, title: row.key }, row.model) },
    { key: 'calls', label: translate('calls'), align: 'right', render: (row) => numeric(row.calls) },
    { key: 'tokens', label: translate('tokens'), align: 'right', render: (row) => numeric(row.tokens) },
    { key: 'cacheHit', label: translate('cacheHit'), align: 'right', render: (row) => formatPercent(row.cacheHitRate) },
    { key: 'cost', label: translate('cost'), align: 'right', render: (row) => formatCost(row.cost) },
  ]
}

/** One provider group with its model ranking. */
function ProviderCard(props: { provider: ProviderUsageView; translate: Translate }) {
  const { provider, translate } = props
  return h('div', { style: styles.providerCard }, [
    h('div', { key: 'head', style: styles.providerHead }, [
      h('span', { key: 'name', style: styles.providerName }, provider.provider),
      h(
        'span',
        { key: 'stats', style: styles.providerStats },
        `${formatCompact(provider.tokens)} · ${formatCost(provider.cost)}`,
      ),
    ]),
    h(DataTable<ModelUsageView>, {
      key: 'models',
      columns: modelColumns(translate),
      rows: provider.models,
      empty: translate('empty'),
      rowKey: (row: ModelUsageView) => row.key,
    }),
  ])
}

/** The statistics page. */
export function Panel(props: { translate: Translate; locale: LocaleLike }) {
  useLocaleRevision(props.locale)
  const translate = props.translate
  const [range, setRange] = useState<SummaryRange>('30')
  const { data, error, loading, refresh } = useSummary(range)

  const totals = data?.totals
  const hasData = data !== null && totals !== undefined && totals.calls > 0
  const backfill = data?.backfill
  const costIncomplete = data !== null && (data.totals.cost.amount === null || data.totals.cost.unpricedCalls > 0)

  const metrics = [
    {
      key: 'tokens',
      label: translate('tokens'),
      value: formatCompact(totals?.tokens),
      note: `${formatCompact(totals?.input)} ${translate('input').toLowerCase()} · ${formatCompact(totals?.output)} ${translate('output').toLowerCase()}`,
      title: formatInteger(totals?.tokens),
    },
    {
      key: 'cost',
      label: translate('cost'),
      value: formatCost(totals?.cost),
      note: costIncomplete ? translate('unpriced') : translate('estimateNote'),
      title: totals?.cost.amount === null ? translate('unpricedHint') : undefined,
    },
    {
      key: 'calls',
      label: translate('calls'),
      value: formatInteger(totals?.calls),
      note: `${formatInteger(data?.counts?.sessions)} ${translate('sessions').toLowerCase()}`,
    },
    {
      key: 'cache',
      label: translate('cacheHit'),
      value: formatPercent(totals?.cacheHitRate),
      note: `${formatCompact(totals?.cacheRead)} ${translate('cacheRead').toLowerCase()}`,
    },
  ]

  const dayColumns: Column<DayUsageView>[] = [
    { key: 'day', label: translate('day'), render: (row) => h('span', { style: styles.cellStrong }, row.day) },
    { key: 'calls', label: translate('calls'), align: 'right', render: (row) => numeric(row.calls) },
    { key: 'tokens', label: translate('tokens'), align: 'right', render: (row) => numeric(row.tokens) },
    { key: 'cacheHit', label: translate('cacheHit'), align: 'right', render: (row) => formatPercent(row.cacheHitRate) },
    { key: 'cost', label: translate('cost'), align: 'right', render: (row) => formatCost(row.cost) },
  ]

  const sessionColumns: Column<SessionUsageView>[] = [
    {
      key: 'sessionId',
      label: translate('session'),
      render: (row) => h('span', { title: row.sessionId }, shortSessionId(row.sessionId)),
    },
    { key: 'calls', label: translate('calls'), align: 'right', render: (row) => numeric(row.calls) },
    { key: 'tokens', label: translate('tokens'), align: 'right', render: (row) => numeric(row.tokens) },
    { key: 'cost', label: translate('cost'), align: 'right', render: (row) => formatCost(row.cost as CostRender) },
    { key: 'lastUsed', label: translate('lastUsed'), align: 'right', render: (row) => formatDateTime(row.lastAt) },
  ]

  const children: ReactNode[] = [
    h('header', { key: 'head', style: styles.head }, [
      h('div', { key: 'heading' }, [
        h('h1', { key: 'title', style: styles.title }, translate('title')),
        h('p', { key: 'subtitle', style: styles.subtitle }, translate('subtitle')),
      ]),
      h('div', { key: 'side', style: styles.headSide }, [
        h('span', { key: 'pill', style: styles.pill }, translate('badge')),
        h(
          'button',
          { key: 'refresh', type: 'button', onClick: refresh, disabled: loading, style: styles.ghostButton },
          translate('refresh'),
        ),
      ]),
    ]),
    h(
      'div',
      { key: 'toolbar', style: styles.toolbar },
      h(
        'div',
        { key: 'ranges', style: styles.segmented, role: 'tablist', 'aria-label': translate('title') },
        RANGES.map((value) =>
          h(
            'button',
            {
              key: value,
              type: 'button',
              role: 'tab',
              'aria-selected': range === value,
              onClick: () => setRange(value),
              style: range === value ? { ...styles.segment, ...styles.segmentActive } : styles.segment,
            },
            rangeLabel(value, translate),
          ),
        ),
      ),
      data === null
        ? null
        : h('span', { key: 'updated', style: styles.cellMuted }, `${translate('updated')} ${formatClock(data.generatedAt)}`),
    ),
  ]

  if (error !== null) {
    children.push(
      h('div', { key: 'error', style: styles.noticeError, role: 'alert' }, [
        h('span', { key: 'text' }, `${translate('loadFailed')} · ${error}`),
        h('button', { key: 'retry', type: 'button', onClick: refresh, style: styles.ghostButton }, translate('retry')),
      ]),
    )
  }

  if (backfill !== undefined && backfill.state === 'running') {
    children.push(
      h(
        'div',
        { key: 'backfill', style: styles.notice },
        `${translate('backfillRunning')} ${formatInteger(backfill.sessions)} / ${formatInteger(backfill.events)}`,
      ),
    )
  } else if (backfill !== undefined && backfill.state === 'error') {
    children.push(
      h('div', { key: 'backfill', style: styles.notice }, `${translate('backfillError')}: ${backfill.error ?? ''}`),
    )
  }

  if (data === null) {
    children.push(h('p', { key: 'loading', style: styles.hint }, translate('loading')))
  } else if (data.totals.calls === 0) {
    children.push(
      h('div', { key: 'empty', style: styles.empty }, [
        h('p', { key: 'title', style: styles.emptyTitle }, translate('empty')),
        h('p', { key: 'hint', style: styles.hint }, translate('emptyHint')),
      ]),
    )
  } else {
    children.push(
      h(
        'div',
        { key: 'metrics', style: styles.metrics },
        metrics.map((metric) =>
          h(Metric, { key: metric.key, label: metric.label, value: metric.value, note: metric.note, title: metric.title }),
        ),
      ),
    )
    if (costIncomplete) {
      children.push(
        h(
          'div',
          { key: 'unpriced', style: styles.notice },
          `${translate('unpriced')} (${formatInteger(data.totals.cost.unpricedCalls)}) · ${translate('unpricedHint')}`,
        ),
      )
    }
    children.push(
      h('section', { key: 'providers', style: styles.section }, [
        h('h2', { key: 'title', style: styles.sectionTitle }, translate('byProvider')),
        ...data.byProvider.map((provider) => h(ProviderCard, { key: provider.provider, provider, translate })),
      ]),
    )
    children.push(
      h('section', { key: 'days', style: styles.section }, [
        h('h2', { key: 'title', style: styles.sectionTitle }, translate('byDay')),
        h(DataTable<DayUsageView>, {
          key: 'table',
          columns: dayColumns,
          rows: data.byDay.slice(0, 31),
          empty: translate('empty'),
          rowKey: (row: DayUsageView) => row.day,
        }),
      ]),
    )
    children.push(
      h('section', { key: 'sessions', style: styles.section }, [
        h('h2', { key: 'title', style: styles.sectionTitle }, translate('sessions')),
        h(DataTable<SessionUsageView>, {
          key: 'table',
          columns: sessionColumns,
          rows: data.sessions,
          empty: translate('empty'),
          rowKey: (row: SessionUsageView) => row.sessionId,
        }),
      ]),
    )
  }

  if (data !== null) {
    children.push(
      h(
        'p',
        { key: 'footer', style: styles.footer },
        `${translate('sourceNote')} · ${translate('estimateNote')} · ${formatInteger(data.counts.samples)} ${translate('records')}`,
      ),
    )
  }

  return h('div', { style: styles.page }, children)
}
