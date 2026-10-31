/**
 * Client locale dictionaries and installation.
 *
 * UI text is registered in the Client locale service under this package's own
 * namespace, so the panel follows the shell's active language. The `locale/*.json`
 * files at the package root are separate: those feed Plugin Manager metadata.
 */

export const NS = 'token-usage-statistic'

export type Translate = (key: string) => string

const EN: Record<string, string> = {
  title: 'Token usage',
  subtitle: 'Every model call recorded in this Harness, aggregated by provider, model, day and session.',
  badge: 'local',
  rangeToday: 'Today',
  range7: '7 days',
  range30: '30 days',
  rangeAll: 'All time',
  tokens: 'Tokens',
  cost: 'Est. cost',
  calls: 'Calls',
  cacheHit: 'Cache hit',
  cacheRead: 'Cache read',
  cacheWrite: 'Cache write',
  input: 'Input',
  output: 'Output',
  total: 'Total',
  byProvider: 'By provider and model',
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
  loadFailed: 'Could not load statistics',
  retry: 'Retry',
  refresh: 'Refresh',
  updated: 'Updated',
  records: 'samples',
  unpriced: 'Some calls have no price',
  unpricedHint: 'They are counted in tokens but excluded from the cost estimate.',
  backfillRunning: 'Scanning historical sessions…',
  backfillDone: 'History scan finished',
  backfillError: 'History scan stopped',
  scanSkipped: 'unchanged',
  sourceNote: 'Source: provider-reported usage in committed session events. Data stays on this machine.',
  estimateNote: 'Cost is an estimate: each sample is priced with the rule effective at its event time.',
}

const ZH: Record<string, string> = {
  title: '模型用量统计',
  subtitle: '记录本机 Harness 中每次模型调用，按提供方、模型、日期和会话汇总。',
  badge: '本地',
  rangeToday: '今日',
  range7: '近 7 天',
  range30: '近 30 天',
  rangeAll: '全部',
  tokens: 'Tokens',
  cost: '预估费用',
  calls: '调用次数',
  cacheHit: '缓存命中',
  cacheRead: '缓存命中量',
  cacheWrite: '缓存写入量',
  input: '输入',
  output: '输出',
  total: '合计',
  byProvider: '按提供方与模型',
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
  loadFailed: '统计数据加载失败',
  retry: '重试',
  refresh: '刷新',
  updated: '更新于',
  records: '条样本',
  unpriced: '部分调用没有单价',
  unpricedHint: '它们计入 token 总数，但不计入费用估算。',
  backfillRunning: '正在回填历史会话…',
  backfillDone: '历史回填完成',
  backfillError: '历史回填中止',
  scanSkipped: '未变化',
  sourceNote: '数据来源：会话事件中 provider 上报的用量，仅保存在本机。',
  estimateNote: '费用是估算值：每个样本按事件发生时生效的价格规则计价。',
}

/** The locale service subset this plugin uses. */
export interface LocaleLike {
  register(namespace: string, locale: string, dictionary: Record<string, string>): () => void
  bind(namespace: string): Translate
  getLocale(): { active: string }
  getSnapshot(): { revision: number }
  subscribe(onChange: () => void): () => void
}

export interface LocaleInstallation {
  translate: Translate
  dispose(): void
}

/** Fallback translator used when the locale service refuses registration. */
export function fallbackTranslate(locale: LocaleLike): Translate {
  return (key) => {
    let active = 'en'
    try {
      active = locale.getLocale().active ?? 'en'
    } catch {
      /* keep English */
    }
    const dictionary = active.toLowerCase().startsWith('zh') ? ZH : EN
    return dictionary[key] ?? EN[key] ?? key
  }
}

/**
 * Register this package's dictionaries and return a translate function.
 *
 * Both shipped locales are registered, plus their regional spellings so a
 * locale id like `zh-CN` still resolves through the fallback chain.
 */
export function installLocale(locale: LocaleLike, warn: (message: string) => void = () => {}): LocaleInstallation {
  const disposers: Array<() => void> = []
  const register = (id: string, dictionary: Record<string, string>): void => {
    try {
      disposers.push(locale.register(NS, id, dictionary))
    } catch (error) {
      warn(`locale registration failed for ${id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  register('en', EN)
  register('zh', ZH)
  register('en-US', EN)
  register('zh-CN', ZH)

  if (disposers.length === 0) return { translate: fallbackTranslate(locale), dispose: () => {} }
  let translate: Translate
  try {
    translate = locale.bind(NS)
  } catch {
    translate = fallbackTranslate(locale)
  }
  return {
    translate,
    dispose: () => {
      for (const dispose of disposers) {
        try {
          dispose()
        } catch {
          /* a doubled disposer must not break unload */
        }
      }
    },
  }
}
