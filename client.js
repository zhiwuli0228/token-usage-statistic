/**
 * Client half of the token-usage-statistic bundle.
 *
 * Loaded by the Harness Web shell (`window.__ModuleLoader__`) in both the Web
 * GUI and the Desktop window, which serve the same page and the same plugin
 * graph. It contributes two root-scoped slots that must agree on one id:
 *
 *  - `sidebar.panellist` — the sidebar row, whose click dispatches
 *    `ctx.layout.selectPanel(id)`.
 *  - `main` — the keyed panel the layout renders for that id.
 *
 * The panel reads its data from the Host half over same-origin HTTP; the Host
 * owns aggregation and durability, the Client owns presentation only.
 */

window.__ModuleLoader__.load({
  id: 'token-usage-statistic',
  factory(require) {
    let React
    try {
      React = require('react')
    } catch {
      /* handled below */
    }

    if (React === undefined || React === null || typeof React.createElement !== 'function') {
      return { name: 'token-usage-statistic', inject: [], apply() {} }
    }

    const h = React.createElement

    /** Locale namespace, also the package name. */
    const NS = 'token-usage-statistic'
    /** Sidebar row id and `main` keyed-slot key: two slots, one spelling. */
    const PANEL_ID = 'token-usage'
    /** Host read model. */
    const SUMMARY_URL = '/token-usage-statistic/api/summary'
    const DEFAULT_REFRESH_MS = 15000
    const RANGES = ['7', '30', 'all']

    const EN = {
      title: 'Token usage',
      subtitle: 'Every model call recorded in this Harness, aggregated by model, day and session.',
      badge: 'local',
      range7: '7 days',
      range30: '30 days',
      rangeAll: 'All time',
      calls: 'Calls',
      input: 'Input',
      output: 'Output',
      cacheRead: 'Cache read',
      cacheWrite: 'Cache write',
      reasoning: 'Reasoning',
      total: 'Total',
      byModel: 'By model',
      byDay: 'By day',
      sessions: 'Sessions',
      model: 'Model',
      provider: 'Provider',
      day: 'Day',
      session: 'Session',
      lastUsed: 'Last used',
      empty: 'No model calls recorded yet',
      emptyHint: 'Usage is collected from committed assistant messages. Send a message, then refresh this panel.',
      loading: 'Loading statistics…',
      error: 'Could not load statistics',
      retry: 'Retry',
      refresh: 'Refresh',
      updated: 'Updated',
      records: 'records',
      sourceNote: 'Source: durable assistant messages. Data stays on this machine.',
    }

    const ZH = {
      title: '模型用量统计',
      subtitle: '记录本机 Harness 中每次模型调用，并按模型、日期和会话汇总。',
      badge: '本地',
      range7: '近 7 天',
      range30: '近 30 天',
      rangeAll: '全部',
      calls: '调用次数',
      input: '输入',
      output: '输出',
      cacheRead: '缓存命中',
      cacheWrite: '缓存写入',
      reasoning: '推理',
      total: '合计',
      byModel: '按模型',
      byDay: '按日期',
      sessions: '会话',
      model: '模型',
      provider: '提供方',
      day: '日期',
      session: '会话',
      lastUsed: '最近使用',
      empty: '还没有记录到模型调用',
      emptyHint: '用量来自已提交的助手消息；发送一条消息后刷新本面板即可看到数据。',
      loading: '正在加载统计数据…',
      error: '统计数据加载失败',
      retry: '重试',
      refresh: '刷新',
      updated: '更新于',
      records: '条记录',
      sourceNote: '数据来源：会话中已提交的助手消息，仅保存在本机。',
    }

    const styles = {
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
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
      section: {
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '960px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      },
      sectionTitle: { margin: 0, fontSize: '13px', fontWeight: 500, color: 'var(--dsw-alias-label-primary, inherit)' },
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
      trLast: { borderBottom: 'none' },
      cellStrong: { fontWeight: 500 },
      cellMuted: { color: 'var(--dsw-alias-label-secondary, inherit)', fontSize: '12px' },
      hint: { margin: 0, fontSize: '13px', color: 'var(--dsw-alias-label-secondary, inherit)' },
      notice: {
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '960px',
        border: '0.5px solid var(--dsw-alias-state-error-primary, #d33)',
        borderRadius: '12px',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        fontSize: '13px',
      },
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
        color: 'var(--dsw-alias-label-secondary, inherit)',
      },
    }

    const integerFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
    const compactFormat = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

    /**
     * Format a whole number with the browser's grouping.
     *
     * @param {unknown} value - count.
     * @returns {string} formatted text.
     */
    function formatInteger(value) {
      const number = typeof value === 'number' && Number.isFinite(value) ? value : 0
      return integerFormat.format(number)
    }

    /**
     * Format a count compactly for a metric card.
     *
     * @param {unknown} value - count.
     * @returns {string} e.g. `12.3k`.
     */
    function formatCompact(value) {
      const number = typeof value === 'number' && Number.isFinite(value) ? value : 0
      return compactFormat.format(number)
    }

    /**
     * Format a wall-clock time.
     *
     * @param {unknown} time - epoch milliseconds.
     * @returns {string} local time text.
     */
    function formatClock(time) {
      const date = new Date(typeof time === 'number' && Number.isFinite(time) ? time : Date.now())
      try {
        return date.toLocaleTimeString()
      } catch {
        return date.toISOString()
      }
    }

    /**
     * Format a full date and time.
     *
     * @param {unknown} time - epoch milliseconds.
     * @returns {string} local date-time text.
     */
    function formatDateTime(time) {
      const date = new Date(typeof time === 'number' && Number.isFinite(time) ? time : Date.now())
      try {
        return date.toLocaleString()
      } catch {
        return date.toISOString()
      }
    }

    /**
     * Shorten a session id for a table cell while keeping it recognizable.
     *
     * @param {unknown} sessionId - full identity.
     * @returns {string} display text.
     */
    function shortSessionId(sessionId) {
      const text = typeof sessionId === 'string' ? sessionId : ''
      if (text.length <= 24) return text
      return `${text.slice(0, 12)}…${text.slice(-6)}`
    }

    /**
     * Translate through the locale service, falling back to the browser
     * language when the service refuses a registration.
     *
     * @param {{ getLocale?: () => { active?: string } }} locale - locale service.
     * @returns {(key: string) => string} translate function.
     */
    function fallbackTranslate(locale) {
      return (key) => {
        let active = 'en'
        try {
          active = locale.getLocale().active ?? 'en'
        } catch {
          /* keep the English fallback */
        }
        const dictionary = active.toLowerCase().startsWith('zh') ? ZH : EN
        return dictionary[key] ?? EN[key] ?? key
      }
    }

    /** Sidebar glyph: a panel outline with three usage bars, themed by `currentColor`. */
    function PanelIcon(props) {
      const edge = typeof props?.size === 'number' && Number.isFinite(props.size) && props.size > 0 ? props.size : 20
      return h(
        'svg',
        {
          width: edge,
          height: edge,
          viewBox: '0 0 20 20',
          fill: 'none',
          'aria-hidden': 'true',
          style: { display: 'block', opacity: props?.active === false ? 0.72 : 1 },
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

    /**
     * One metric card.
     *
     * @param {{ label: string, value: string, exact: number }} props - rendered values.
     * @returns {import('react').ReactElement} the card.
     */
    function StatCard({ label, value, exact }) {
      return h('div', { style: styles.metric, title: `${label}: ${formatInteger(exact)}` }, [
        h('span', { key: 'label', style: styles.metricLabel }, label),
        h('span', { key: 'value', style: styles.metricValue }, value),
      ])
    }

    /**
     * A simple, themed table. Columns carry their own renderer so numeric cells
     * can keep the exact value in a tooltip while showing a grouped number.
     *
     * @param {{ columns: Array<{ key: string, label: string, align?: 'left'|'right', render?: (row: any) => any }>, rows: any[], empty: string }} props - table description.
     * @returns {import('react').ReactElement} the table or an empty hint.
     */
    function DataTable({ columns, rows, empty }) {
      if (rows.length === 0) return h('p', { style: styles.hint }, empty)
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
              columns.map((column) =>
                h('th', { key: column.key, style: { ...styles.th, textAlign: column.align ?? 'left' } }, column.label),
              ),
            ),
          ),
          h(
            'tbody',
            { key: 'body' },
            rows.map((row, index) =>
              h(
                'tr',
                { key: row.key ?? index },
                columns.map((column) =>
                  h(
                    'td',
                    {
                      key: column.key,
                      style: {
                        ...styles.td,
                        textAlign: column.align ?? 'left',
                        ...(index === rows.length - 1 ? styles.trLast : null),
                      },
                    },
                    column.render === undefined ? row[column.key] : column.render(row),
                  ),
                ),
              ),
            ),
          ),
        ]),
      )
    }

    /**
     * The numeric cell renderer: grouped text, exact value on hover.
     *
     * @param {unknown} value - count.
     * @returns {import('react').ReactElement} the span.
     */
    function numericCell(value) {
      const number = typeof value === 'number' && Number.isFinite(value) ? value : 0
      return h('span', { title: formatInteger(number) }, formatInteger(number))
    }

    /**
     * Read the summary with polling and a manual refresh.
     *
     * @param {string} range - `7`, `30`, or `all`.
     * @returns {{ data: any, error: string | null, loading: boolean, refresh: () => void }} read state.
     */
    function useSummary(range) {
      const [data, setData] = React.useState(null)
      const [error, setError] = React.useState(null)
      const [loading, setLoading] = React.useState(true)
      const [nonce, setNonce] = React.useState(0)

      const configured = data?.config?.refreshMs
      const refreshMs =
        typeof configured === 'number' && Number.isFinite(configured) ? Math.max(3000, configured) : DEFAULT_REFRESH_MS

      React.useEffect(() => {
        let cancelled = false
        const controller = new AbortController()

        const load = async () => {
          try {
            const response = await fetch(`${SUMMARY_URL}?days=${encodeURIComponent(range)}&recent=20`, {
              cache: 'no-store',
              signal: controller.signal,
            })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const payload = await response.json()
            if (cancelled) return
            setData(payload)
            setError(null)
          } catch (cause) {
            if (cancelled) return
            if (cause !== null && typeof cause === 'object' && cause.name === 'AbortError') return
            setError(cause instanceof Error ? cause.message : String(cause))
          } finally {
            if (!cancelled) setLoading(false)
          }
        }

        setLoading(true)
        load()
        return () => {
          cancelled = true
          controller.abort()
        }
      }, [range, nonce])

      React.useEffect(() => {
        const timer = setInterval(() => {
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
          setNonce((value) => value + 1)
        }, refreshMs)
        return () => clearInterval(timer)
      }, [refreshMs])

      const refresh = React.useCallback(() => setNonce((value) => value + 1), [])

      return { data, error, loading, refresh }
    }

    /**
     * Re-render when the active locale or any dictionary changes.
     *
     * @param {{ subscribe: (fn: () => void) => () => void, getSnapshot: () => { revision: number } }} locale - locale service.
     * @returns {number} the current revision (unused, but drives the subscription).
     */
    function useLocaleRevision(locale) {
      return React.useSyncExternalStore(
        React.useCallback((notify) => locale.subscribe(notify), [locale]),
        React.useCallback(() => locale.getSnapshot().revision, [locale]),
        React.useCallback(() => 0, []),
      )
    }

    /**
     * The statistics panel.
     *
     * @param {{ t: (key: string) => string, locale: any }} props - translate function and locale service.
     * @returns {import('react').ReactElement} the page.
     */
    function Panel({ t, locale }) {
      useLocaleRevision(locale)
      const [range, setRange] = React.useState('30')
      const { data, error, loading, refresh } = useSummary(range)

      const totals = data?.totals
      const hasData = totals !== undefined && totals.calls > 0

      const metrics = [
        { key: 'calls', label: t('calls'), value: formatCompact(totals?.calls), exact: totals?.calls },
        { key: 'input', label: t('input'), value: formatCompact(totals?.inputTokens), exact: totals?.inputTokens },
        { key: 'output', label: t('output'), value: formatCompact(totals?.outputTokens), exact: totals?.outputTokens },
        { key: 'cacheRead', label: t('cacheRead'), value: formatCompact(totals?.cacheReadTokens), exact: totals?.cacheReadTokens },
        { key: 'cacheWrite', label: t('cacheWrite'), value: formatCompact(totals?.cacheWriteTokens), exact: totals?.cacheWriteTokens },
        { key: 'reasoning', label: t('reasoning'), value: formatCompact(totals?.reasoningTokens), exact: totals?.reasoningTokens },
      ]

      const modelColumns = [
        {
          key: 'model',
          label: t('model'),
          render: (row) => h('span', { style: styles.cellStrong, title: `${row.provider}/${row.model}` }, row.model),
        },
        {
          key: 'provider',
          label: t('provider'),
          render: (row) => h('span', { style: styles.cellMuted }, row.provider),
        },
        { key: 'calls', label: t('calls'), align: 'right', render: (row) => numericCell(row.calls) },
        { key: 'inputTokens', label: t('input'), align: 'right', render: (row) => numericCell(row.inputTokens) },
        { key: 'outputTokens', label: t('output'), align: 'right', render: (row) => numericCell(row.outputTokens) },
        { key: 'cacheReadTokens', label: t('cacheRead'), align: 'right', render: (row) => numericCell(row.cacheReadTokens) },
        { key: 'totalTokens', label: t('total'), align: 'right', render: (row) => numericCell(row.totalTokens) },
      ]

      const dayColumns = [
        { key: 'day', label: t('day'), render: (row) => h('span', { style: styles.cellStrong }, row.day) },
        { key: 'calls', label: t('calls'), align: 'right', render: (row) => numericCell(row.calls) },
        { key: 'inputTokens', label: t('input'), align: 'right', render: (row) => numericCell(row.inputTokens) },
        { key: 'outputTokens', label: t('output'), align: 'right', render: (row) => numericCell(row.outputTokens) },
        { key: 'totalTokens', label: t('total'), align: 'right', render: (row) => numericCell(row.totalTokens) },
      ]

      const sessionColumns = [
        {
          key: 'sessionId',
          label: t('session'),
          render: (row) => h('span', { title: row.sessionId }, shortSessionId(row.sessionId)),
        },
        { key: 'calls', label: t('calls'), align: 'right', render: (row) => numericCell(row.calls) },
        { key: 'totalTokens', label: t('total'), align: 'right', render: (row) => numericCell(row.totalTokens) },
        { key: 'lastUsedAt', label: t('lastUsed'), align: 'right', render: (row) => formatDateTime(row.lastUsedAt) },
      ]

      const rangeLabel = (value) => (value === 'all' ? t('rangeAll') : value === '7' ? t('range7') : t('range30'))

      return h('div', { style: styles.page }, [
        h('header', { key: 'head', style: styles.head }, [
          h('div', { key: 'heading' }, [
            h('h1', { key: 'title', style: styles.title }, t('title')),
            h('p', { key: 'subtitle', style: styles.subtitle }, t('subtitle')),
          ]),
          h('div', { key: 'side', style: styles.headSide }, [
            h('span', { key: 'pill', style: styles.pill }, t('badge')),
            h(
              'button',
              { key: 'refresh', type: 'button', onClick: refresh, disabled: loading, style: styles.ghostButton },
              t('refresh'),
            ),
          ]),
        ]),

        h(
          'div',
          { key: 'toolbar', style: styles.toolbar },
          h(
            'div',
            { key: 'ranges', style: styles.segmented, role: 'tablist', 'aria-label': t('title') },
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
                rangeLabel(value),
              ),
            ),
          ),
          data === null
            ? null
            : h(
                'span',
                { key: 'updated', style: styles.cellMuted },
                `${t('updated')} ${formatClock(data.generatedAt)}`,
              ),
        ),

        error === null
          ? null
          : h('div', { key: 'error', style: styles.notice, role: 'alert' }, [
              h('span', { key: 'text' }, `${t('error')} · ${error}`),
              h('button', { key: 'retry', type: 'button', onClick: refresh, style: styles.ghostButton }, t('retry')),
            ]),

        data === null
          ? h('p', { key: 'loading', style: styles.hint }, t('loading'))
          : hasData
            ? h('div', { key: 'body', style: { display: 'contents' } }, [
                h(
                  'div',
                  { key: 'metrics', style: styles.metrics },
                  metrics.map((metric) =>
                    h(StatCard, { key: metric.key, label: metric.label, value: metric.value, exact: metric.exact }),
                  ),
                ),
                h('section', { key: 'models', style: styles.section }, [
                  h('h2', { key: 'title', style: styles.sectionTitle }, t('byModel')),
                  h(DataTable, { key: 'table', columns: modelColumns, rows: data.byModel, empty: t('empty') }),
                ]),
                h('section', { key: 'days', style: styles.section }, [
                  h('h2', { key: 'title', style: styles.sectionTitle }, t('byDay')),
                  h(DataTable, {
                    key: 'table',
                    columns: dayColumns,
                    rows: data.byDay.slice(0, 31),
                    empty: t('empty'),
                  }),
                ]),
                h('section', { key: 'sessions', style: styles.section }, [
                  h('h2', { key: 'title', style: styles.sectionTitle }, t('sessions')),
                  h(DataTable, { key: 'table', columns: sessionColumns, rows: data.sessions, empty: t('empty') }),
                ]),
              ])
            : h('div', { key: 'empty', style: styles.empty }, [
                h('p', { key: 'title', style: styles.emptyTitle }, t('empty')),
                h('p', { key: 'hint', style: styles.hint }, t('emptyHint')),
              ]),

        data === null
          ? null
          : h(
              'p',
              { key: 'footer', style: styles.footer },
              `${t('sourceNote')} · ${formatInteger(data.counts?.records)} ${t('records')}`,
            ),
      ])
    }

    const inject = ['slots', 'locale']

    /**
     * Activate the Client half.
     *
     * @param {any} ctx - Client context.
     * @returns {void}
     */
    function apply(ctx) {
      const dictionaryDisposers = []
      const register = (locale, dictionary) => {
        try {
          dictionaryDisposers.push(ctx.locale.register(NS, locale, dictionary))
        } catch (cause) {
          console.warn('[token-usage-statistic] locale registration failed:', cause)
        }
      }
      register('en', EN)
      register('zh', ZH)
      register('en-US', EN)
      register('zh-CN', ZH)

      const translate =
        dictionaryDisposers.length > 0
          ? ctx.locale.bind(NS)
          : fallbackTranslate(ctx.locale)

      if (dictionaryDisposers.length > 0) {
        ctx.effect(() => () => {
          for (const dispose of dictionaryDisposers) {
            try {
              dispose()
            } catch {
              /* a doubled disposer must not break unload */
            }
          }
        })
      }

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 45,
            label: () => translate('title'),
          },
          (props) => h(PanelIcon, props ?? {}),
        ),
      )

      ctx.slots.inject('main', () =>
        ctx.slots.register({ name: 'main', key: PANEL_ID, inject: () => ({}) }, () =>
          h(Panel, { t: translate, locale: ctx.locale }),
        ),
      )
    }

    return { name: 'token-usage-statistic', inject, apply }
  },
})
