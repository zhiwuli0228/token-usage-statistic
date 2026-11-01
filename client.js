"use strict";
(() => {
  // src/client/i18n.ts
  var NS = "token-usage-statistic";
  var EN = {
    title: "Token usage",
    subtitle: "Every model call recorded in this Harness, aggregated by provider, model, day and session.",
    badge: "local",
    tabUsage: "Usage",
    tabAccounts: "Accounts",
    tabExport: "Export",
    rangeToday: "Today",
    range7: "7 days",
    range30: "30 days",
    rangeAll: "All time",
    tokens: "Tokens",
    cost: "Est. cost",
    calls: "Calls",
    cacheHit: "Cache hit",
    cacheRead: "Cache read",
    cacheWrite: "Cache write",
    input: "Input",
    output: "Output",
    total: "Total",
    byProvider: "By provider and model",
    byDay: "By day",
    sessions: "Sessions",
    model: "Model",
    provider: "Provider",
    day: "Day",
    session: "Session",
    lastUsed: "Last used",
    empty: "No model calls recorded yet",
    emptyHint: "Usage is collected from committed assistant messages. Send a message, then refresh this panel.",
    loading: "Loading statistics\u2026",
    loadFailed: "Could not load statistics",
    retry: "Retry",
    refresh: "Refresh",
    updated: "Updated",
    records: "samples",
    unpriced: "Some calls have no price",
    unpricedHint: "They are counted in tokens but excluded from the cost estimate.",
    backfillRunning: "Scanning historical sessions\u2026",
    backfillDone: "History scan finished",
    backfillError: "History scan stopped",
    sourceNote: "Source: provider-reported usage in committed session events. Data stays on this machine.",
    estimateNote: "Cost is an estimate: each sample is priced with the rule effective at its event time.",
    budgetDaily: "Today",
    budgetMonthly: "This month",
    budgetIncomplete: "cost incomplete",
    budgetNoLimit: "No limit",
    accountsEmpty: "No account sources detected. Sign in to DeepSeek or configure an llm-pi-ai provider.",
    accountsRefresh: "Refresh accounts",
    accountsUpdated: "Accounts updated",
    accountsLoading: "Loading accounts\u2026",
    accountsError: "Account query failed",
    accountsNote: "Balances are queried by the Host only; credentials never reach this page.",
    accountsBalance: "Balance",
    accountsUsed: "Used",
    accountsLimit: "Limit",
    accountsGranted: "Granted",
    accountsToppedUp: "Topped up",
    accountsPlan: "Plan",
    accountsNoQuota: "No quota windows reported",
    accountsStatusOk: "live",
    accountsStatusUnconfigured: "not signed in",
    accountsStatusUnsupported: "no public interface",
    accountsStatusError: "query failed",
    accountsStale: "stale",
    accountsWindowRemaining: "left",
    accountsSignInHint: "Sign in to the DeepSeek account in DSH, or set the provider credential, then refresh.",
    exportTitle: "Export",
    exportNote: "Secret-free exports: tokens, estimates, budgets and account status only. No prompts, replies or credentials.",
    exportDaily: "Daily CSV",
    exportDailyHint: "One row per day, provider and model.",
    exportSessions: "Sessions CSV",
    exportSessionsHint: "One row per session with its providers and models.",
    exportJson: "Versioned JSON",
    exportJsonHint: "Usage, budgets and account snapshots in one document.",
    chartTitle: "Daily usage",
    chartMetricTokens: "Tokens",
    chartMetricCalls: "Calls",
    chartMetricCost: "Cost",
    chartHint: "Click a bar to view the details for that day.",
    chartEmpty: "No daily usage to chart yet.",
    dayDetailTitle: "Details for {{day}}",
    dayDetailSessions: "Sessions",
    dayDetailModels: "Models"
  };
  var ZH = {
    title: "\u6A21\u578B\u7528\u91CF\u7EDF\u8BA1",
    subtitle: "\u8BB0\u5F55\u672C\u673A Harness \u4E2D\u6BCF\u6B21\u6A21\u578B\u8C03\u7528\uFF0C\u6309\u63D0\u4F9B\u65B9\u3001\u6A21\u578B\u3001\u65E5\u671F\u548C\u4F1A\u8BDD\u6C47\u603B\u3002",
    badge: "\u672C\u5730",
    tabUsage: "\u7528\u91CF",
    tabAccounts: "\u8D26\u6237",
    tabExport: "\u5BFC\u51FA",
    rangeToday: "\u4ECA\u65E5",
    range7: "\u8FD1 7 \u5929",
    range30: "\u8FD1 30 \u5929",
    rangeAll: "\u5168\u90E8",
    tokens: "Tokens",
    cost: "\u9884\u4F30\u8D39\u7528",
    calls: "\u8C03\u7528\u6B21\u6570",
    cacheHit: "\u7F13\u5B58\u547D\u4E2D",
    cacheRead: "\u7F13\u5B58\u547D\u4E2D\u91CF",
    cacheWrite: "\u7F13\u5B58\u5199\u5165\u91CF",
    input: "\u8F93\u5165",
    output: "\u8F93\u51FA",
    total: "\u5408\u8BA1",
    byProvider: "\u6309\u63D0\u4F9B\u65B9\u4E0E\u6A21\u578B",
    byDay: "\u6309\u65E5\u671F",
    sessions: "\u4F1A\u8BDD",
    model: "\u6A21\u578B",
    provider: "\u63D0\u4F9B\u65B9",
    day: "\u65E5\u671F",
    session: "\u4F1A\u8BDD",
    lastUsed: "\u6700\u8FD1\u4F7F\u7528",
    empty: "\u8FD8\u6CA1\u6709\u8BB0\u5F55\u5230\u6A21\u578B\u8C03\u7528",
    emptyHint: "\u7528\u91CF\u6765\u81EA\u5DF2\u63D0\u4EA4\u7684\u52A9\u624B\u6D88\u606F\uFF1B\u53D1\u9001\u4E00\u6761\u6D88\u606F\u540E\u5237\u65B0\u672C\u9762\u677F\u5373\u53EF\u770B\u5230\u6570\u636E\u3002",
    loading: "\u6B63\u5728\u52A0\u8F7D\u7EDF\u8BA1\u6570\u636E\u2026",
    loadFailed: "\u7EDF\u8BA1\u6570\u636E\u52A0\u8F7D\u5931\u8D25",
    retry: "\u91CD\u8BD5",
    refresh: "\u5237\u65B0",
    updated: "\u66F4\u65B0\u4E8E",
    records: "\u6761\u6837\u672C",
    unpriced: "\u90E8\u5206\u8C03\u7528\u6CA1\u6709\u5355\u4EF7",
    unpricedHint: "\u5B83\u4EEC\u8BA1\u5165 token \u603B\u6570\uFF0C\u4F46\u4E0D\u8BA1\u5165\u8D39\u7528\u4F30\u7B97\u3002",
    backfillRunning: "\u6B63\u5728\u56DE\u586B\u5386\u53F2\u4F1A\u8BDD\u2026",
    backfillDone: "\u5386\u53F2\u56DE\u586B\u5B8C\u6210",
    backfillError: "\u5386\u53F2\u56DE\u586B\u4E2D\u6B62",
    sourceNote: "\u6570\u636E\u6765\u6E90\uFF1A\u4F1A\u8BDD\u4E8B\u4EF6\u4E2D provider \u4E0A\u62A5\u7684\u7528\u91CF\uFF0C\u4EC5\u4FDD\u5B58\u5728\u672C\u673A\u3002",
    estimateNote: "\u8D39\u7528\u662F\u4F30\u7B97\u503C\uFF1A\u6BCF\u4E2A\u6837\u672C\u6309\u4E8B\u4EF6\u53D1\u751F\u65F6\u751F\u6548\u7684\u4EF7\u683C\u89C4\u5219\u8BA1\u4EF7\u3002",
    budgetDaily: "\u4ECA\u65E5",
    budgetMonthly: "\u672C\u6708",
    budgetIncomplete: "\u8D39\u7528\u4E0D\u5B8C\u6574",
    budgetNoLimit: "\u672A\u8BBE\u7F6E\u4E0A\u9650",
    accountsEmpty: "\u6CA1\u6709\u53D1\u73B0\u53EF\u67E5\u8BE2\u7684\u8D26\u6237\u6765\u6E90\u3002\u8BF7\u767B\u5F55 DeepSeek \u8D26\u6237\uFF0C\u6216\u914D\u7F6E llm-pi-ai \u63D0\u4F9B\u65B9\u3002",
    accountsRefresh: "\u5237\u65B0\u8D26\u6237",
    accountsUpdated: "\u8D26\u6237\u66F4\u65B0\u4E8E",
    accountsLoading: "\u6B63\u5728\u52A0\u8F7D\u8D26\u6237\u2026",
    accountsError: "\u8D26\u6237\u67E5\u8BE2\u5931\u8D25",
    accountsNote: "\u4F59\u989D\u53EA\u7531 Host \u67E5\u8BE2\uFF0C\u51ED\u636E\u4E0D\u4F1A\u8FDB\u5165\u672C\u9875\u9762\u3002",
    accountsBalance: "\u4F59\u989D",
    accountsUsed: "\u5DF2\u7528",
    accountsLimit: "\u4E0A\u9650",
    accountsGranted: "\u8D60\u9001",
    accountsToppedUp: "\u5145\u503C",
    accountsPlan: "\u5957\u9910",
    accountsNoQuota: "\u672A\u8FD4\u56DE\u989D\u5EA6\u7A97\u53E3",
    accountsStatusOk: "\u6B63\u5E38",
    accountsStatusUnconfigured: "\u672A\u767B\u5F55/\u672A\u914D\u7F6E",
    accountsStatusUnsupported: "\u65E0\u516C\u5F00\u63A5\u53E3",
    accountsStatusError: "\u67E5\u8BE2\u5931\u8D25",
    accountsStale: "\u65E7\u6570\u636E",
    accountsWindowRemaining: "\u5269\u4F59",
    accountsSignInHint: "\u5728 DSH \u4E2D\u767B\u5F55 DeepSeek \u8D26\u6237\uFF0C\u6216\u914D\u7F6E\u63D0\u4F9B\u65B9\u51ED\u636E\u540E\u5237\u65B0\u3002",
    exportTitle: "\u5BFC\u51FA",
    exportNote: "\u65E0\u51ED\u636E\u5BFC\u51FA\uFF1A\u4EC5\u5305\u542B token\u3001\u8D39\u7528\u4F30\u7B97\u3001\u9884\u7B97\u4E0E\u8D26\u6237\u72B6\u6001\uFF0C\u4E0D\u542B\u63D0\u793A\u8BCD\u3001\u56DE\u590D\u6216\u51ED\u636E\u3002",
    exportDaily: "\u6309\u65E5 CSV",
    exportDailyHint: "\u6BCF\u884C\u5BF9\u5E94\u4E00\u4E2A\u65E5\u671F\u3001\u63D0\u4F9B\u65B9\u4E0E\u6A21\u578B\u3002",
    exportSessions: "\u4F1A\u8BDD CSV",
    exportSessionsHint: "\u6BCF\u884C\u4E00\u4E2A\u4F1A\u8BDD\u53CA\u5176\u63D0\u4F9B\u65B9\u4E0E\u6A21\u578B\u3002",
    exportJson: "\u7248\u672C\u5316 JSON",
    exportJsonHint: "\u7528\u91CF\u3001\u9884\u7B97\u4E0E\u8D26\u6237\u5FEB\u7167\u5408\u6210\u4E00\u4EFD\u6587\u6863\u3002",
    chartTitle: "\u6BCF\u65E5\u7528\u91CF",
    chartMetricTokens: "Tokens",
    chartMetricCalls: "\u8C03\u7528\u6B21\u6570",
    chartMetricCost: "\u9884\u4F30\u8D39\u7528",
    chartHint: "\u70B9\u51FB\u67F1\u72B6\u56FE\u67E5\u770B\u5F53\u5929\u7684\u8BE6\u60C5\u3002",
    chartEmpty: "\u5C1A\u65E0\u6BCF\u65E5\u7528\u91CF\u6570\u636E\u3002",
    dayDetailTitle: "{{day}} \u8BE6\u60C5",
    dayDetailSessions: "\u4F1A\u8BDD",
    dayDetailModels: "\u6A21\u578B"
  };
  function fallbackTranslate(locale) {
    return (key) => {
      let active = "en";
      try {
        active = locale.getLocale().active ?? "en";
      } catch {
      }
      const dictionary = active.toLowerCase().startsWith("zh") ? ZH : EN;
      return dictionary[key] ?? EN[key] ?? key;
    };
  }
  function installLocale(locale, warn = () => {
  }) {
    const disposers = [];
    const register = (id, dictionary) => {
      try {
        disposers.push(locale.register(NS, id, dictionary));
      } catch (error) {
        warn(`locale registration failed for ${id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    register("en", EN);
    register("zh", ZH);
    register("en-US", EN);
    register("zh-CN", ZH);
    if (disposers.length === 0) return { translate: fallbackTranslate(locale), dispose: () => {
    } };
    let translate;
    try {
      translate = locale.bind(NS);
    } catch {
      translate = fallbackTranslate(locale);
    }
    return {
      translate,
      dispose: () => {
        for (const dispose of disposers) {
          try {
            dispose();
          } catch {
          }
        }
      }
    };
  }

  // src/client/format.ts
  var integerFormat = new Intl.NumberFormat(void 0, { maximumFractionDigits: 0 });
  var compactFormat = new Intl.NumberFormat(void 0, { notation: "compact", maximumFractionDigits: 1 });
  function formatInteger(value) {
    return integerFormat.format(typeof value === "number" && Number.isFinite(value) ? value : 0);
  }
  function formatCompact(value) {
    return compactFormat.format(typeof value === "number" && Number.isFinite(value) ? value : 0);
  }
  function formatCost(cost) {
    if (cost === void 0 || cost === null) return "\u2014";
    if (cost.amount === null) return "\u2014";
    if (cost.currency === null) return cost.amount === 0 ? "0" : String(cost.amount);
    try {
      return new Intl.NumberFormat(void 0, {
        style: "currency",
        currency: cost.currency,
        maximumFractionDigits: cost.amount !== 0 && Math.abs(cost.amount) < 1 ? 4 : 2
      }).format(cost.amount);
    } catch {
      return `${cost.amount} ${cost.currency}`;
    }
  }
  function formatPercent(rate) {
    if (typeof rate !== "number" || !Number.isFinite(rate)) return "\u2014";
    return `${rate.toFixed(1)}%`;
  }
  function formatMoney(amount, currency) {
    if (typeof amount !== "number" || !Number.isFinite(amount)) return "\u2014";
    if (currency === null || currency === void 0) return formatInteger(amount);
    try {
      return new Intl.NumberFormat(void 0, {
        style: "currency",
        currency,
        maximumFractionDigits: amount !== 0 && Math.abs(amount) < 1 ? 4 : 2
      }).format(amount);
    } catch {
      return `${amount} ${currency}`;
    }
  }
  function formatClock(time) {
    const date = new Date(typeof time === "number" && Number.isFinite(time) ? time : Date.now());
    try {
      return date.toLocaleTimeString();
    } catch {
      return date.toISOString();
    }
  }
  function formatDateTime(time) {
    const date = new Date(typeof time === "number" && Number.isFinite(time) ? time : Date.now());
    try {
      return date.toLocaleString();
    } catch {
      return date.toISOString();
    }
  }
  function shortSessionId(sessionId) {
    if (sessionId.length <= 24) return sessionId;
    return `${sessionId.slice(0, 12)}\u2026${sessionId.slice(-6)}`;
  }

  // src/client/react.ts
  var api = null;
  function bindReact(value) {
    api = value;
  }
  function getReact() {
    if (api === null) throw new Error("[token-usage-statistic] React is not bound");
    return api;
  }
  var h = ((...args) => getReact().createElement(...args));
  function useState(initial) {
    return getReact().useState(initial);
  }
  function useEffect(effect, dependencies) {
    ;
    getReact().useEffect(effect, dependencies);
  }
  function useCallback(callback, dependencies) {
    return getReact().useCallback(callback, dependencies);
  }
  function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
    const react = getReact();
    const hook = react.useSyncExternalStore;
    return hook(subscribe, getSnapshot, getServerSnapshot);
  }

  // src/client/panel.ts
  var SUMMARY_URL = "/token-usage-statistic/api/summary";
  var DAILY_URL = "/token-usage-statistic/api/daily";
  var DEFAULT_REFRESH_MS = 15e3;
  var RANGES = ["1", "7", "30", "all"];
  var styles = {
    page: {
      boxSizing: "border-box",
      height: "100%",
      overflow: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "18px",
      padding: "0 clamp(20px, 4vw, 44px) 40px",
      color: "var(--dsw-alias-label-primary, inherit)"
    },
    head: {
      boxSizing: "border-box",
      width: "100%",
      maxWidth: "960px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: "16px",
      paddingTop: "calc(28px + var(--dsh-frame-top-clearance, 0px))"
    },
    title: { margin: 0, fontSize: "20px", fontWeight: 500, lineHeight: "28px" },
    subtitle: { margin: "4px 0 0", fontSize: "13px", lineHeight: "20px", color: "var(--dsw-alias-label-secondary, inherit)" },
    headSide: { display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 },
    pill: {
      fontSize: "11px",
      color: "var(--dsw-alias-label-secondary, inherit)",
      border: "0.5px solid var(--dsw-alias-border-l1, #e2e2e2)",
      borderRadius: "999px",
      padding: "2px 8px",
      whiteSpace: "nowrap"
    },
    toolbar: {
      width: "100%",
      maxWidth: "960px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      flexWrap: "wrap"
    },
    segmented: {
      display: "inline-flex",
      gap: "2px",
      padding: "2px",
      borderRadius: "10px",
      border: "0.5px solid var(--dsw-alias-border-l1, #e2e2e2)"
    },
    segment: {
      font: "inherit",
      fontSize: "12px",
      lineHeight: "20px",
      padding: "2px 10px",
      borderRadius: "8px",
      border: "none",
      background: "transparent",
      color: "var(--dsw-alias-label-secondary, inherit)",
      cursor: "pointer"
    },
    segmentActive: {
      background: "var(--dsw-alias-bg-layer-2, rgba(0,0,0,0.06))",
      color: "var(--dsw-alias-label-primary, inherit)",
      fontWeight: 500
    },
    ghostButton: {
      font: "inherit",
      fontSize: "12px",
      lineHeight: "20px",
      padding: "3px 12px",
      borderRadius: "999px",
      border: "0.5px solid var(--dsw-alias-border-l1, #e2e2e2)",
      background: "transparent",
      color: "var(--dsw-alias-label-primary, inherit)",
      cursor: "pointer"
    },
    metrics: {
      width: "100%",
      maxWidth: "960px",
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      gap: "10px"
    },
    metric: {
      boxSizing: "border-box",
      border: "0.5px solid var(--dsw-alias-border-l1, #e2e2e2)",
      borderRadius: "14px",
      background: "var(--dsw-alias-bg-layer-1, transparent)",
      padding: "12px 14px",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      minWidth: 0
    },
    metricLabel: { fontSize: "12px", color: "var(--dsw-alias-label-secondary, inherit)" },
    metricValue: { fontSize: "20px", fontWeight: 600, lineHeight: "26px", fontVariantNumeric: "tabular-nums" },
    metricNote: { fontSize: "11px", color: "var(--dsw-alias-label-secondary, inherit)" },
    notice: {
      boxSizing: "border-box",
      width: "100%",
      maxWidth: "960px",
      border: "0.5px solid var(--dsw-alias-border-l1, #e2e2e2)",
      borderRadius: "12px",
      padding: "9px 14px",
      fontSize: "12px",
      color: "var(--dsw-alias-label-secondary, inherit)",
      background: "var(--dsw-alias-bg-layer-1, transparent)"
    },
    noticeError: {
      boxSizing: "border-box",
      width: "100%",
      maxWidth: "960px",
      border: "0.5px solid var(--dsw-alias-state-error-primary, #d33)",
      borderRadius: "12px",
      padding: "9px 14px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      fontSize: "13px"
    },
    section: {
      boxSizing: "border-box",
      width: "100%",
      maxWidth: "960px",
      display: "flex",
      flexDirection: "column",
      gap: "8px"
    },
    sectionTitle: { margin: 0, fontSize: "13px", fontWeight: 500 },
    tableWrap: {
      overflowX: "auto",
      border: "0.5px solid var(--dsw-alias-border-l1, #e2e2e2)",
      borderRadius: "14px",
      background: "var(--dsw-alias-bg-layer-1, transparent)"
    },
    table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
    th: {
      fontSize: "11px",
      fontWeight: 500,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      color: "var(--dsw-alias-label-secondary, inherit)",
      padding: "8px 12px",
      borderBottom: "0.5px solid var(--dsw-alias-border-l1, #e2e2e2)",
      whiteSpace: "nowrap"
    },
    td: {
      padding: "7px 12px",
      borderBottom: "0.5px solid var(--dsw-alias-border-l1, #e2e2e2)",
      verticalAlign: "middle",
      fontVariantNumeric: "tabular-nums"
    },
    cellStrong: { fontWeight: 500 },
    cellMuted: { color: "var(--dsw-alias-label-secondary, inherit)", fontSize: "12px" },
    hint: { margin: 0, fontSize: "13px", color: "var(--dsw-alias-label-secondary, inherit)" },
    empty: {
      boxSizing: "border-box",
      width: "100%",
      maxWidth: "960px",
      border: "0.5px solid var(--dsw-alias-border-l1, #e2e2e2)",
      borderRadius: "14px",
      background: "var(--dsw-alias-bg-layer-1, transparent)",
      padding: "32px 20px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "6px",
      textAlign: "center"
    },
    emptyTitle: { margin: 0, fontSize: "14px", fontWeight: 500 },
    footer: {
      width: "100%",
      maxWidth: "960px",
      margin: "0 0 8px",
      fontSize: "11px",
      lineHeight: "18px",
      color: "var(--dsw-alias-label-secondary, inherit)"
    },
    providerCard: {
      boxSizing: "border-box",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      border: "0.5px solid var(--dsw-alias-border-l1, #e2e2e2)",
      borderRadius: "14px",
      background: "var(--dsw-alias-bg-layer-1, transparent)",
      padding: "10px 12px"
    },
    providerHead: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: "12px"
    },
    providerName: { fontSize: "13px", fontWeight: 500 },
    providerStats: { fontSize: "12px", color: "var(--dsw-alias-label-secondary, inherit)", fontVariantNumeric: "tabular-nums" },
    budgetRow: {
      boxSizing: "border-box",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      gap: "6px"
    },
    budgetHead: { display: "flex", justifyContent: "space-between", gap: "12px", fontSize: "12px", color: "var(--dsw-alias-label-secondary, inherit)" },
    progressTrack: {
      width: "100%",
      height: "6px",
      borderRadius: "999px",
      background: "var(--dsw-alias-bg-layer-2, rgba(0,0,0,0.08))",
      overflow: "hidden"
    },
    progressFill: { height: "100%", borderRadius: "999px", background: "var(--dsw-alias-brand-primary, #2563eb)" },
    accountCard: {
      boxSizing: "border-box",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      border: "0.5px solid var(--dsw-alias-border-l1, #e2e2e2)",
      borderRadius: "14px",
      background: "var(--dsw-alias-bg-layer-1, transparent)",
      padding: "12px 14px"
    },
    accountHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" },
    accountName: { fontSize: "14px", fontWeight: 500 },
    accountBadge: {
      fontSize: "11px",
      borderRadius: "999px",
      padding: "1px 8px",
      border: "0.5px solid var(--dsw-alias-border-l1, #e2e2e2)",
      color: "var(--dsw-alias-label-secondary, inherit)",
      whiteSpace: "nowrap"
    },
    accountBadgeError: { borderColor: "var(--dsw-alias-state-error-primary, #d33)", color: "var(--dsw-alias-state-error-primary, #d33)" },
    accountBadgeWarn: { borderColor: "var(--dsw-alias-state-warn-primary, #d97706)", color: "var(--dsw-alias-state-warn-primary, #d97706)" },
    accountFigures: { display: "flex", flexWrap: "wrap", gap: "16px" },
    figure: { display: "flex", flexDirection: "column", gap: "2px", minWidth: "90px" },
    figureLabel: { fontSize: "11px", color: "var(--dsw-alias-label-secondary, inherit)" },
    figureValue: { fontSize: "16px", fontWeight: 600, fontVariantNumeric: "tabular-nums" },
    quotaRow: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", fontSize: "12px" },
    quotaLabel: { color: "var(--dsw-alias-label-secondary, inherit)" },
    exportItem: {
      boxSizing: "border-box",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      border: "0.5px solid var(--dsw-alias-border-l1, #e2e2e2)",
      borderRadius: "14px",
      padding: "12px 14px",
      background: "var(--dsw-alias-bg-layer-1, transparent)"
    },
    exportLink: {
      alignSelf: "flex-start",
      font: "inherit",
      fontSize: "13px",
      lineHeight: "20px",
      padding: "4px 12px",
      borderRadius: "999px",
      border: "0.5px solid var(--dsw-alias-border-l1, #e2e2e2)",
      color: "var(--dsw-alias-label-primary, inherit)",
      textDecoration: "none"
    },
    exportHint: { margin: 0, fontSize: "12px", color: "var(--dsw-alias-label-secondary, inherit)" },
    chart: {
      boxSizing: "border-box",
      width: "100%",
      maxWidth: "960px",
      display: "flex",
      flexDirection: "column",
      gap: "12px"
    },
    chartPlot: {
      boxSizing: "border-box",
      width: "100%",
      height: "200px",
      display: "flex",
      alignItems: "flex-end",
      gap: "3px",
      padding: "12px 0 34px",
      borderBottom: "0.5px solid var(--dsw-alias-border-l1, #e2e2e2)"
    },
    chartBarCol: {
      flex: 1,
      minWidth: 0,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: "4px",
      border: "none",
      background: "transparent",
      cursor: "pointer",
      padding: 0
    },
    chartBar: {
      width: "100%",
      maxWidth: "24px",
      minHeight: "2px",
      borderRadius: "4px 4px 0 0",
      background: "var(--dsw-alias-brand-primary, #2563eb)",
      opacity: 0.35
    },
    chartBarActive: {
      background: "var(--dsw-alias-brand-primary, #2563eb)",
      opacity: 1
    },
    chartLabel: {
      position: "absolute",
      bottom: "-26px",
      left: "50%",
      transform: "translateX(-50%)",
      fontSize: "10px",
      color: "var(--dsw-alias-label-secondary, inherit)",
      whiteSpace: "nowrap"
    },
    chartHint: { margin: 0, fontSize: "12px", color: "var(--dsw-alias-label-secondary, inherit)" },
    dayDetail: {
      boxSizing: "border-box",
      width: "100%",
      maxWidth: "960px",
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    },
    dayDetailHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px" }
  };
  function DataTable(props) {
    if (props.rows.length === 0) return h("p", { style: styles.hint }, props.empty);
    return h(
      "div",
      { style: styles.tableWrap },
      h("table", { style: styles.table }, [
        h(
          "thead",
          { key: "head" },
          h(
            "tr",
            null,
            props.columns.map(
              (column) => h("th", { key: column.key, style: { ...styles.th, textAlign: column.align ?? "left" } }, column.label)
            )
          )
        ),
        h(
          "tbody",
          { key: "body" },
          props.rows.map(
            (row, index) => h(
              "tr",
              { key: props.rowKey(row, index) },
              props.columns.map(
                (column) => h(
                  "td",
                  { key: column.key, style: { ...styles.td, textAlign: column.align ?? "left" } },
                  column.render === void 0 ? row[column.key] : column.render(row)
                )
              )
            )
          )
        )
      ])
    );
  }
  function Metric(props) {
    return h("div", { style: styles.metric, title: props.title }, [
      h("span", { key: "label", style: styles.metricLabel }, props.label),
      h("span", { key: "value", style: styles.metricValue }, props.value),
      props.note === void 0 ? null : h("span", { key: "note", style: styles.metricNote }, props.note)
    ]);
  }
  function numeric(value) {
    return h("span", { title: formatInteger(value) }, formatInteger(value));
  }
  function useLocaleRevision(locale) {
    return useSyncExternalStore(
      useCallback((onChange) => locale.subscribe(onChange), [locale]),
      useCallback(() => locale.getSnapshot().revision, [locale]),
      useCallback(() => 0, [])
    );
  }
  function useSummary(range) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [nonce, setNonce] = useState(0);
    const configured = data?.config?.refreshMs;
    const refreshMs = typeof configured === "number" && Number.isFinite(configured) ? Math.max(3e3, configured) : DEFAULT_REFRESH_MS;
    useEffect(() => {
      let cancelled = false;
      const controller = new AbortController();
      const load = async () => {
        try {
          const response = await fetch(`${SUMMARY_URL}?days=${encodeURIComponent(range)}&recent=20`, {
            cache: "no-store",
            signal: controller.signal
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload = await response.json();
          if (cancelled) return;
          setData(payload);
          setError(null);
        } catch (cause) {
          if (cancelled) return;
          if (cause !== null && typeof cause === "object" && cause.name === "AbortError") return;
          setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      setLoading(true);
      void load();
      return () => {
        cancelled = true;
        controller.abort();
      };
    }, [range, nonce]);
    useEffect(() => {
      const timer = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
        setNonce((value) => value + 1);
      }, refreshMs);
      return () => clearInterval(timer);
    }, [refreshMs]);
    const refresh = useCallback(() => setNonce((value) => value + 1), []);
    return { data, error, loading, refresh };
  }
  function rangeLabel(range, translate) {
    if (range === "1") return translate("rangeToday");
    if (range === "7") return translate("range7");
    if (range === "30") return translate("range30");
    return translate("rangeAll");
  }
  function useDaily(range) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [nonce, setNonce] = useState(0);
    useEffect(() => {
      let cancelled = false;
      const controller = new AbortController();
      const load = async () => {
        try {
          const response = await fetch(`${DAILY_URL}?days=${encodeURIComponent(range)}`, {
            cache: "no-store",
            signal: controller.signal
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload = await response.json();
          if (cancelled) return;
          setData(payload);
          setError(null);
        } catch (cause) {
          if (cancelled) return;
          if (cause !== null && typeof cause === "object" && cause.name === "AbortError") return;
          setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      setLoading(true);
      void load();
      return () => {
        cancelled = true;
        controller.abort();
      };
    }, [range, nonce]);
    useEffect(() => {
      const timer = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
        setNonce((value) => value + 1);
      }, DEFAULT_REFRESH_MS);
      return () => clearInterval(timer);
    }, []);
    const refresh = useCallback(() => setNonce((value) => value + 1), []);
    return { data, error, loading, refresh };
  }
  function modelColumns(translate) {
    return [
      { key: "model", label: translate("model"), render: (row) => h("span", { style: styles.cellStrong, title: row.key }, row.model) },
      { key: "calls", label: translate("calls"), align: "right", render: (row) => numeric(row.calls) },
      { key: "tokens", label: translate("tokens"), align: "right", render: (row) => numeric(row.tokens) },
      { key: "cacheHit", label: translate("cacheHit"), align: "right", render: (row) => formatPercent(row.cacheHitRate) },
      { key: "cost", label: translate("cost"), align: "right", render: (row) => formatCost(row.cost) }
    ];
  }
  function SessionNameCell(props) {
    const { row } = props;
    const hasName = row.name !== null && row.name.length > 0;
    const hasWorkspace = row.workspace !== null && row.workspace.length > 0;
    return h("div", { style: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 } }, [
      h(
        "span",
        {
          key: "primary",
          style: { ...styles.cellStrong, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
          title: row.sessionId
        },
        hasName ? row.name : shortSessionId(row.sessionId)
      ),
      hasWorkspace ? h(
        "span",
        {
          key: "workspace",
          style: { ...styles.cellMuted, fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
          title: row.workspace ?? void 0
        },
        row.workspace
      ) : null,
      hasName ? h(
        "span",
        {
          key: "id",
          style: { ...styles.cellMuted, fontSize: "11px" },
          title: row.sessionId
        },
        shortSessionId(row.sessionId)
      ) : null
    ]);
  }
  function sessionColumns(translate) {
    return [
      {
        key: "sessionId",
        label: translate("session"),
        render: (row) => h(SessionNameCell, { row })
      },
      { key: "calls", label: translate("calls"), align: "right", render: (row) => numeric(row.calls) },
      { key: "tokens", label: translate("tokens"), align: "right", render: (row) => numeric(row.tokens) },
      { key: "cost", label: translate("cost"), align: "right", render: (row) => formatCost(row.cost) },
      { key: "lastUsed", label: translate("lastUsed"), align: "right", render: (row) => formatDateTime(row.lastAt) }
    ];
  }
  function DayDetail(props) {
    const { day, translate } = props;
    return h("div", { style: styles.dayDetail }, [
      h("div", { key: "head", style: styles.dayDetailHead }, [
        h("h2", { key: "title", style: styles.sectionTitle }, translate("dayDetailTitle").replace("{{day}}", day.day)),
        h("span", { key: "summary", style: styles.cellMuted }, `${formatInteger(day.calls)} ${translate("calls")} \xB7 ${formatCompact(day.tokens)} ${translate("tokens")} \xB7 ${formatCost(day.cost)}`)
      ]),
      h("section", { key: "sessions", style: styles.section }, [
        h("h3", { key: "title", style: styles.sectionTitle }, translate("dayDetailSessions")),
        h(DataTable, {
          key: "table",
          columns: sessionColumns(translate),
          rows: day.sessions,
          empty: translate("empty"),
          rowKey: (row) => row.sessionId
        })
      ]),
      h("section", { key: "models", style: styles.section }, [
        h("h3", { key: "title", style: styles.sectionTitle }, translate("dayDetailModels")),
        h(DataTable, {
          key: "table",
          columns: modelColumns(translate),
          rows: day.models,
          empty: translate("empty"),
          rowKey: (row) => row.key
        })
      ])
    ]);
  }
  var METRIC_LABELS = {
    tokens: "chartMetricTokens",
    calls: "chartMetricCalls",
    cost: "chartMetricCost"
  };
  function chartValueOf(day, metric) {
    if (metric === "calls") return day.calls;
    if (metric === "cost") return day.cost.amount ?? 0;
    return day.tokens;
  }
  function chartLabelOf(day, metric) {
    if (metric === "cost") return formatCost(day.cost);
    const value = metric === "calls" ? day.calls : day.tokens;
    return formatCompact(value);
  }
  function DailyChart(props) {
    const { days, metric, selectedDay, onSelectDay, translate } = props;
    if (days.length === 0) {
      return h("div", { style: styles.empty }, [h("p", { key: "title", style: styles.emptyTitle }, translate("chartEmpty"))]);
    }
    const max = Math.max(...days.map((day) => chartValueOf(day, metric)));
    const plotHeight = 160;
    const labelStep = Math.max(1, Math.ceil(days.length / 10));
    return h("div", { style: styles.chart }, [
      h(
        "div",
        { key: "plot", style: styles.chartPlot },
        days.map((day, index) => {
          const value = chartValueOf(day, metric);
          const barHeight = max > 0 ? Math.max(2, value / max * plotHeight) : 2;
          const selected = selectedDay === day.day;
          return h(
            "button",
            {
              key: day.day,
              type: "button",
              title: `${day.day}: ${chartLabelOf(day, metric)}`,
              onClick: () => onSelectDay(day.day),
              style: { ...styles.chartBarCol, position: "relative" }
            },
            [
              h("div", {
                key: "bar",
                style: {
                  ...styles.chartBar,
                  height: `${barHeight}px`,
                  ...selected ? styles.chartBarActive : {}
                }
              }),
              index % labelStep === 0 || index === days.length - 1 ? h("span", { key: "label", style: styles.chartLabel }, day.day.slice(5)) : null
            ]
          );
        })
      ),
      h("p", { key: "hint", style: styles.chartHint }, translate("chartHint"))
    ]);
  }
  function ProviderCard(props) {
    const { provider, translate } = props;
    return h("div", { style: styles.providerCard }, [
      h("div", { key: "head", style: styles.providerHead }, [
        h("span", { key: "name", style: styles.providerName }, provider.provider),
        h(
          "span",
          { key: "stats", style: styles.providerStats },
          `${formatCompact(provider.tokens)} \xB7 ${formatCost(provider.cost)}`
        )
      ]),
      h(DataTable, {
        key: "models",
        columns: modelColumns(translate),
        rows: provider.models,
        empty: translate("empty"),
        rowKey: (row) => row.key
      })
    ]);
  }
  var ACCOUNTS_URL = "/token-usage-statistic/api/accounts";
  var EXPORTS = {
    daily: "/token-usage-statistic/api/export/daily.csv",
    sessions: "/token-usage-statistic/api/export/sessions.csv",
    json: "/token-usage-statistic/api/export.json"
  };
  function figureOf(label, value) {
    return h("div", { style: styles.figure }, [
      h("span", { key: "label", style: styles.figureLabel }, label),
      h("span", { key: "value", style: styles.figureValue }, value)
    ]);
  }
  function quotaText(window, translate) {
    const unit = window.unit === null ? "" : ` ${window.unit}`;
    if (window.used !== null && window.limit !== null) return `${formatInteger(window.used)} / ${formatInteger(window.limit)}${unit}`;
    if (window.remaining !== null) return `${formatInteger(window.remaining)}${unit} ${translate("accountsWindowRemaining")}`;
    if (window.limit !== null) return `${formatInteger(window.limit)}${unit}`;
    return "\u2014";
  }
  function BudgetBar(props) {
    const window = props.window;
    if (window === void 0 || window.limit === null) return null;
    const incomplete = !window.costComplete || window.percent === null;
    const fill = incomplete ? 0 : Math.max(0, Math.min(100, window.percent ?? 0));
    const color = window.level === "exceeded" ? "var(--dsw-alias-state-error-primary, #d33)" : window.level === "warn" ? "var(--dsw-alias-state-warn-primary, #d97706)" : "var(--dsw-alias-brand-primary, #2563eb)";
    const value = incomplete ? props.translate("budgetIncomplete") : `${formatMoney(window.spend ?? 0, window.currency)} / ${formatMoney(window.limit, window.currency)} \xB7 ${(window.percent ?? 0).toFixed(1)}%`;
    return h("div", { style: styles.budgetRow }, [
      h("div", { key: "head", style: styles.budgetHead }, [
        h("span", { key: "label" }, props.label),
        h("span", { key: "value" }, value)
      ]),
      h(
        "div",
        { key: "track", style: styles.progressTrack },
        h("div", { style: { ...styles.progressFill, width: `${fill}%`, background: color } })
      )
    ]);
  }
  function AccountCard(props) {
    const { account, translate } = props;
    const badgeText = account.status === "ok" ? translate("accountsStatusOk") : account.status === "error" ? translate("accountsStatusError") : account.status === "unsupported" ? translate("accountsStatusUnsupported") : translate("accountsStatusUnconfigured");
    const badgeStyle = account.status === "error" ? { ...styles.accountBadge, ...styles.accountBadgeError } : account.status === "unconfigured" || account.status === "unsupported" ? styles.accountBadge : account.stale ? { ...styles.accountBadge, ...styles.accountBadgeWarn } : styles.accountBadge;
    const children = [
      h("div", { key: "head", style: styles.accountHead }, [
        h("span", { key: "name", style: styles.accountName }, account.displayName),
        h(
          "span",
          { key: "badge", style: badgeStyle },
          account.stale && account.status === "ok" ? `${badgeText} \xB7 ${translate("accountsStale")}` : badgeText
        )
      ])
    ];
    const balance = account.balance;
    if (balance !== void 0) {
      const figures = [figureOf(translate("accountsBalance"), formatMoney(balance.total, balance.currency))];
      if (balance.toppedUp !== null) figures.push(figureOf(translate("accountsToppedUp"), formatMoney(balance.toppedUp, balance.currency)));
      if (balance.granted !== null) figures.push(figureOf(translate("accountsGranted"), formatMoney(balance.granted, balance.currency)));
      if (balance.used !== null) figures.push(figureOf(translate("accountsUsed"), formatMoney(balance.used, balance.currency)));
      if (balance.limit !== null) figures.push(figureOf(translate("accountsLimit"), formatMoney(balance.limit, balance.currency)));
      children.push(h("div", { key: "figures", style: styles.accountFigures }, figures));
    }
    if (account.subscription !== void 0) {
      children.push(
        h("div", { key: "plan", style: styles.quotaRow }, [
          h("span", { key: "label", style: styles.quotaLabel }, translate("accountsPlan")),
          h("span", { key: "value" }, account.subscription.plan ?? "\u2014")
        ])
      );
      if (account.subscription.windows.length === 0) {
        children.push(h("p", { key: "noquota", style: styles.exportHint }, translate("accountsNoQuota")));
      } else {
        children.push(
          h(
            "div",
            { key: "windows", style: { display: "flex", flexDirection: "column", gap: "4px" } },
            account.subscription.windows.map(
              (window) => h("div", { key: window.id, style: styles.quotaRow }, [
                h("span", { key: "label", style: styles.quotaLabel }, window.label),
                h("span", { key: "value" }, quotaText(window, translate))
              ])
            )
          )
        );
      }
    }
    if (account.lastError !== null) children.push(h("p", { key: "error", style: styles.exportHint }, account.lastError));
    if (account.status === "unconfigured") {
      children.push(h("p", { key: "hint", style: styles.exportHint }, translate("accountsSignInHint")));
    }
    return h("div", { style: styles.accountCard }, children);
  }
  function useAccounts() {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [request, setRequest] = useState({ nonce: 0, force: false });
    useEffect(() => {
      let cancelled = false;
      const controller = new AbortController();
      const load = async () => {
        try {
          const url = request.force ? `${ACCOUNTS_URL}?refresh=1` : ACCOUNTS_URL;
          const response = await fetch(url, { cache: "no-store", signal: controller.signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload = await response.json();
          if (cancelled) return;
          setData(payload);
          setError(null);
        } catch (cause) {
          if (cancelled) return;
          if (cause !== null && typeof cause === "object" && cause.name === "AbortError") return;
          setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      setLoading(true);
      void load();
      return () => {
        cancelled = true;
        controller.abort();
      };
    }, [request]);
    useEffect(() => {
      const timer = setInterval(() => setRequest((value) => ({ nonce: value.nonce + 1, force: false })), 6e4);
      return () => clearInterval(timer);
    }, []);
    const refresh = useCallback(() => setRequest((value) => ({ nonce: value.nonce + 1, force: true })), []);
    return { data, error, loading, refresh };
  }
  function AccountsPage(props) {
    useLocaleRevision(props.locale);
    const { data, error, loading, refresh } = useAccounts();
    const translate = props.translate;
    const children = [
      h(
        "div",
        { key: "toolbar", style: styles.toolbar },
        h("span", { key: "updated", style: styles.cellMuted }, data === null ? "" : `${translate("accountsUpdated")} ${formatClock(data.generatedAt)}`),
        h(
          "button",
          { key: "refresh", type: "button", onClick: refresh, disabled: loading, style: styles.ghostButton },
          translate("accountsRefresh")
        )
      )
    ];
    if (error !== null) {
      children.push(
        h("div", { key: "error", style: styles.noticeError, role: "alert" }, `${translate("accountsError")} \xB7 ${error}`)
      );
    }
    if (data === null) {
      children.push(h("p", { key: "loading", style: styles.hint }, translate("accountsLoading")));
    } else if (data.accounts.length === 0) {
      children.push(
        h("div", { key: "empty", style: styles.empty }, [
          h("p", { key: "title", style: styles.emptyTitle }, translate("accountsEmpty"))
        ])
      );
    } else {
      children.push(
        h(
          "div",
          { key: "list", style: { ...styles.section, gap: "10px" } },
          data.accounts.map((account) => h(AccountCard, { key: account.id, account, translate }))
        )
      );
    }
    children.push(h("p", { key: "note", style: styles.footer }, translate("accountsNote")));
    return h("div", { style: { display: "contents" } }, children);
  }
  function ExportPage(props) {
    const translate = props.translate;
    const links = [
      { key: "daily", href: EXPORTS.daily, file: "token-usage-daily.csv", title: translate("exportDaily"), hint: translate("exportDailyHint") },
      { key: "sessions", href: EXPORTS.sessions, file: "token-usage-sessions.csv", title: translate("exportSessions"), hint: translate("exportSessionsHint") },
      { key: "json", href: EXPORTS.json, file: "token-usage-export.json", title: translate("exportJson"), hint: translate("exportJsonHint") }
    ];
    return h("div", { style: { display: "contents" } }, [
      h(
        "div",
        { key: "list", style: { ...styles.section, gap: "10px" } },
        links.map(
          (link) => h("div", { key: link.key, style: styles.exportItem }, [
            h("a", { key: "link", href: link.href, download: link.file, style: styles.exportLink }, link.title),
            h("p", { key: "hint", style: styles.exportHint }, link.hint)
          ])
        )
      ),
      h("p", { key: "note", style: styles.footer }, translate("exportNote"))
    ]);
  }
  function Panel(props) {
    useLocaleRevision(props.locale);
    const translate = props.translate;
    const [tab, setTab] = useState("usage");
    const [range, setRange] = useState("30");
    const [chartMetric, setChartMetric] = useState("tokens");
    const [selectedDay, setSelectedDay] = useState(null);
    const { data, error, loading, refresh } = useSummary(range);
    const { data: dailyData, error: dailyError, loading: dailyLoading, refresh: refreshDaily } = useDaily(range);
    useEffect(() => {
      if (dailyData === null || dailyData.days.length === 0) return;
      setSelectedDay((current) => current === null ? dailyData.days[0].day : current);
    }, [dailyData]);
    const totals = data?.totals;
    const costIncomplete = data !== null && (data.totals.cost.amount === null || data.totals.cost.unpricedCalls > 0);
    const backfill = data?.backfill;
    const metrics = [
      {
        key: "tokens",
        label: translate("tokens"),
        value: formatCompact(totals?.tokens),
        note: `${formatCompact(totals?.input)} ${translate("input").toLowerCase()} \xB7 ${formatCompact(totals?.output)} ${translate("output").toLowerCase()}`,
        title: formatInteger(totals?.tokens)
      },
      {
        key: "cost",
        label: translate("cost"),
        value: formatCost(totals?.cost),
        note: costIncomplete ? translate("unpriced") : translate("estimateNote"),
        title: totals?.cost.amount === null ? translate("unpricedHint") : void 0
      },
      {
        key: "calls",
        label: translate("calls"),
        value: formatInteger(totals?.calls),
        note: `${formatInteger(data?.counts?.sessions)} ${translate("sessions").toLowerCase()}`
      },
      {
        key: "cache",
        label: translate("cacheHit"),
        value: formatPercent(totals?.cacheHitRate),
        note: `${formatCompact(totals?.cacheRead)} ${translate("cacheRead").toLowerCase()}`
      }
    ];
    const tabItems = [
      { id: "usage", label: translate("tabUsage") },
      { id: "accounts", label: translate("tabAccounts") },
      { id: "export", label: translate("tabExport") }
    ];
    const children = [
      h("header", { key: "head", style: styles.head }, [
        h("div", { key: "heading" }, [
          h("h1", { key: "title", style: styles.title }, translate("title")),
          h("p", { key: "subtitle", style: styles.subtitle }, translate("subtitle"))
        ]),
        h("div", { key: "side", style: styles.headSide }, [
          h("span", { key: "pill", style: styles.pill }, translate("badge")),
          tab === "usage" ? h(
            "button",
            { key: "refresh", type: "button", onClick: refresh, disabled: loading, style: styles.ghostButton },
            translate("refresh")
          ) : null
        ])
      ]),
      h(
        "div",
        { key: "tabs", style: styles.toolbar },
        h(
          "div",
          { key: "tabgroup", style: styles.segmented, role: "tablist", "aria-label": translate("title") },
          tabItems.map(
            (item) => h(
              "button",
              {
                key: item.id,
                type: "button",
                role: "tab",
                "aria-selected": tab === item.id,
                onClick: () => setTab(item.id),
                style: tab === item.id ? { ...styles.segment, ...styles.segmentActive } : styles.segment
              },
              item.label
            )
          )
        )
      )
    ];
    if (tab === "usage") {
      children.push(
        h(
          "div",
          { key: "toolbar", style: styles.toolbar },
          h(
            "div",
            { key: "ranges", style: styles.segmented, role: "group", "aria-label": translate("title") },
            RANGES.map(
              (value) => h(
                "button",
                {
                  key: value,
                  type: "button",
                  "aria-pressed": range === value,
                  onClick: () => setRange(value),
                  style: range === value ? { ...styles.segment, ...styles.segmentActive } : styles.segment
                },
                rangeLabel(value, translate)
              )
            )
          ),
          h(
            "div",
            { key: "metrics", style: styles.segmented, role: "group", "aria-label": translate("chartTitle") },
            ["tokens", "calls", "cost"].map(
              (metric) => h(
                "button",
                {
                  key: metric,
                  type: "button",
                  "aria-pressed": chartMetric === metric,
                  onClick: () => setChartMetric(metric),
                  style: chartMetric === metric ? { ...styles.segment, ...styles.segmentActive } : styles.segment
                },
                translate(METRIC_LABELS[metric])
              )
            )
          ),
          data === null ? null : h("span", { key: "updated", style: styles.cellMuted }, `${translate("updated")} ${formatClock(data.generatedAt)}`)
        )
      );
      if (error !== null) {
        children.push(
          h("div", { key: "error", style: styles.noticeError, role: "alert" }, [
            h("span", { key: "text" }, `${translate("loadFailed")} \xB7 ${error}`),
            h("button", { key: "retry", type: "button", onClick: refresh, style: styles.ghostButton }, translate("retry"))
          ])
        );
      }
      if (backfill !== void 0 && backfill.state === "running") {
        children.push(
          h(
            "div",
            { key: "backfill", style: styles.notice },
            `${translate("backfillRunning")} ${formatInteger(backfill.sessions)} / ${formatInteger(backfill.events)}`
          )
        );
      } else if (backfill !== void 0 && backfill.state === "error") {
        children.push(h("div", { key: "backfill", style: styles.notice }, `${translate("backfillError")}: ${backfill.error ?? ""}`));
      }
      if (data === null) {
        children.push(h("p", { key: "loading", style: styles.hint }, translate("loading")));
      } else if (data.totals.calls === 0) {
        children.push(
          h("div", { key: "empty", style: styles.empty }, [
            h("p", { key: "title", style: styles.emptyTitle }, translate("empty")),
            h("p", { key: "hint", style: styles.hint }, translate("emptyHint"))
          ])
        );
      } else {
        children.push(
          h(
            "div",
            { key: "metrics", style: styles.metrics },
            metrics.map(
              (metric) => h(Metric, { key: metric.key, label: metric.label, value: metric.value, note: metric.note, title: metric.title })
            )
          )
        );
        if (data.budgets.daily.limit !== null || data.budgets.monthly.limit !== null) {
          children.push(
            h(
              "div",
              { key: "budgets", style: { width: "100%", maxWidth: "960px", display: "flex", flexDirection: "column", gap: "10px" } },
              [
                h(BudgetBar, { key: "daily", label: translate("budgetDaily"), window: data.budgets.daily, translate }),
                h(BudgetBar, { key: "monthly", label: translate("budgetMonthly"), window: data.budgets.monthly, translate })
              ]
            )
          );
        }
        if (costIncomplete) {
          children.push(
            h(
              "div",
              { key: "unpriced", style: styles.notice },
              `${translate("unpriced")} (${formatInteger(data.totals.cost.unpricedCalls)}) \xB7 ${translate("unpricedHint")}`
            )
          );
        }
        children.push(
          h("section", { key: "providers", style: styles.section }, [
            h("h2", { key: "title", style: styles.sectionTitle }, translate("byProvider")),
            ...data.byProvider.map((provider) => h(ProviderCard, { key: provider.provider, provider, translate }))
          ])
        );
        children.push(
          h("section", { key: "days", style: styles.section }, [
            h("h2", { key: "title", style: styles.sectionTitle }, translate("chartTitle")),
            h(DailyChart, {
              key: "chart",
              days: dailyData?.days ?? [],
              metric: chartMetric,
              selectedDay,
              onSelectDay: setSelectedDay,
              translate
            })
          ])
        );
        if (dailyError !== null) {
          children.push(
            h("div", { key: "daily-error", style: styles.noticeError, role: "alert" }, `${translate("loadFailed")} \xB7 ${dailyError}`)
          );
        }
        const dayDetail = dailyData?.days.find((day) => day.day === selectedDay);
        if (dayDetail !== void 0) {
          children.push(h(DayDetail, { key: "day-detail", day: dayDetail, translate }));
        }
        children.push(
          h("section", { key: "sessions", style: styles.section }, [
            h("h2", { key: "title", style: styles.sectionTitle }, translate("sessions")),
            h(DataTable, {
              key: "table",
              columns: sessionColumns(translate),
              rows: data.sessions,
              empty: translate("empty"),
              rowKey: (row) => row.sessionId
            })
          ])
        );
      }
      if (data !== null) {
        children.push(
          h(
            "p",
            { key: "footer", style: styles.footer },
            `${translate("sourceNote")} \xB7 ${translate("estimateNote")} \xB7 ${formatInteger(data.counts.samples)} ${translate("records")}`
          )
        );
      }
    } else if (tab === "accounts") {
      children.push(h(AccountsPage, { key: "accounts", translate, locale: props.locale }));
    } else {
      children.push(h(ExportPage, { key: "export", translate }));
    }
    return h("div", { style: styles.page }, children);
  }

  // src/client/plugin.ts
  var PANEL_ID = "token-usage";
  var ORDER = 45;
  function PanelIcon(props) {
    const edge = typeof props.size === "number" && Number.isFinite(props.size) && props.size > 0 ? props.size : 20;
    return h(
      "svg",
      {
        width: edge,
        height: edge,
        viewBox: "0 0 20 20",
        fill: "none",
        "aria-hidden": "true",
        style: { display: "block", opacity: props.active === false ? 0.72 : 1 }
      },
      [
        h("rect", {
          key: "frame",
          x: 2.4,
          y: 3.2,
          width: 15.2,
          height: 13.6,
          rx: 3.2,
          stroke: "currentColor",
          strokeWidth: 1.3
        }),
        h("path", {
          key: "bars",
          d: "M6.4 13.2V9.6M10 13.2V6.8M13.6 13.2V8.4",
          stroke: "currentColor",
          strokeWidth: 1.5,
          strokeLinecap: "round"
        })
      ]
    );
  }
  function createClientModule() {
    return {
      name: "token-usage-statistic",
      inject: ["slots", "locale"],
      apply(ctx) {
        const installation = installLocale(ctx.locale, (message) => {
          try {
            console.warn("[token-usage-statistic]", message);
          } catch {
          }
        });
        ctx.effect(() => () => installation.dispose());
        ctx.slots.inject(
          "sidebar.panellist",
          () => ctx.slots.register(
            {
              name: "sidebar.panellist",
              id: PANEL_ID,
              order: ORDER,
              label: () => installation.translate("title")
            },
            (props) => h(PanelIcon, props ?? {})
          )
        );
        ctx.slots.inject(
          "main",
          () => ctx.slots.register(
            { name: "main", key: PANEL_ID, inject: () => ({}) },
            () => h(Panel, { translate: installation.translate, locale: ctx.locale })
          )
        );
      }
    };
  }

  // src/client/index.ts
  var loader = globalThis.window?.__ModuleLoader__;
  if (loader !== void 0 && typeof loader.load === "function") {
    loader.load({
      id: "token-usage-statistic",
      factory(require2) {
        let React = null;
        try {
          React = require2("react");
        } catch {
          React = null;
        }
        if (React === null || typeof React.createElement !== "function") {
          return { name: "token-usage-statistic", inject: [], apply() {
          } };
        }
        bindReact(React);
        return createClientModule();
      }
    });
  }
})();
