// src/host/index.ts
import { mkdir as mkdir3, writeFile as writeFile2 } from "node:fs/promises";
import path4 from "node:path";

// src/host/export.ts
var EXPORT_SCHEMA_VERSION = "1.0.0";
var CSV_FORMULA_PREFIX = /^[\t\r\n ]*[=+\-@]/;
function csvCell(value, text = false) {
  if (value === null || value === void 0) return '""';
  let rendered = String(value);
  if (text && CSV_FORMULA_PREFIX.test(rendered)) rendered = `'${rendered}`;
  return `"${rendered.replaceAll('"', '""')}"`;
}
function csv(rows) {
  return `\uFEFF${rows.map((row) => row.map((cell) => csvCell(cell.value, cell.text)).join(",")).join("\r\n")}\r
`;
}
function numeric(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}
function dailyCsv(store) {
  const rows = [[
    { value: "date" },
    { value: "provider" },
    { value: "model" },
    { value: "calls" },
    { value: "input_tokens" },
    { value: "cache_read_tokens" },
    { value: "cache_write_tokens" },
    { value: "output_tokens" },
    { value: "total_tokens" },
    { value: "cache_hit_rate" },
    { value: "estimated_cost" },
    { value: "currency" },
    { value: "cost_complete" }
  ]];
  for (const row of store.dailyRows()) {
    rows.push([
      { value: row.day, text: true },
      { value: row.provider, text: true },
      { value: row.model, text: true },
      { value: row.calls },
      { value: row.input },
      { value: row.cacheRead },
      { value: row.cacheWrite },
      { value: row.output },
      { value: row.tokens },
      { value: numeric(row.cacheHitRate) },
      { value: row.cost.complete ? numeric(row.cost.amount) : "" },
      { value: row.cost.complete ? row.cost.currency : "", text: true },
      { value: row.cost.complete }
    ]);
  }
  return csv(rows);
}
function sessionsCsv(store) {
  const rows = [[
    { value: "session_id" },
    { value: "providers" },
    { value: "models" },
    { value: "calls" },
    { value: "input_tokens" },
    { value: "cache_read_tokens" },
    { value: "cache_write_tokens" },
    { value: "output_tokens" },
    { value: "total_tokens" },
    { value: "cache_hit_rate" },
    { value: "estimated_cost" },
    { value: "currency" },
    { value: "cost_complete" },
    { value: "first_at" },
    { value: "last_at" }
  ]];
  for (const row of store.sessionRows()) {
    rows.push([
      { value: row.sessionId, text: true },
      { value: row.providers.join(" | "), text: true },
      { value: row.models.join(" | "), text: true },
      { value: row.calls },
      { value: row.input },
      { value: row.cacheRead },
      { value: row.cacheWrite },
      { value: row.output },
      { value: row.tokens },
      { value: numeric(row.cacheHitRate) },
      { value: row.cost.complete ? numeric(row.cost.amount) : "" },
      { value: row.cost.complete ? row.cost.currency : "", text: true },
      { value: row.cost.complete },
      { value: new Date(row.firstAt).toISOString(), text: true },
      { value: new Date(row.lastAt).toISOString(), text: true }
    ]);
  }
  return csv(rows);
}
function jsonExport(options) {
  const { store } = options;
  const exportedAt = options.exportedAt ?? Date.now();
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date(exportedAt).toISOString(),
    pricing: { catalogUpdatedAt: store.pricingCatalogUpdatedAt() },
    days: store.dailyRows().map((row) => ({
      date: row.day,
      provider: row.provider,
      model: row.model,
      calls: row.calls,
      tokens: { input: row.input, cacheRead: row.cacheRead, cacheWrite: row.cacheWrite, output: row.output, total: row.tokens },
      cacheHitRate: row.cacheHitRate,
      cost: { amount: row.cost.complete ? row.cost.amount : null, currency: row.cost.complete ? row.cost.currency : null, complete: row.cost.complete }
    })),
    sessions: store.sessionRows().map((row) => ({
      sessionId: row.sessionId,
      providers: row.providers,
      models: row.models,
      calls: row.calls,
      tokens: { input: row.input, cacheRead: row.cacheRead, cacheWrite: row.cacheWrite, output: row.output, total: row.tokens },
      cacheHitRate: row.cacheHitRate,
      cost: { amount: row.cost.complete ? row.cost.amount : null, currency: row.cost.complete ? row.cost.currency : null, complete: row.cost.complete },
      firstAt: new Date(row.firstAt).toISOString(),
      lastAt: new Date(row.lastAt).toISOString()
    })),
    budgets: options.budgets,
    accounts: options.accounts.map((account) => ({
      id: account.id,
      displayName: account.displayName,
      mode: account.mode,
      adapter: account.adapter,
      configured: account.configured,
      status: account.status,
      stale: account.stale,
      fetchedAt: account.fetchedAt,
      lastError: account.lastError,
      balance: account.balance ? {
        currency: account.balance.currency,
        total: account.balance.total,
        used: account.balance.used,
        limit: account.balance.limit,
        granted: account.balance.granted,
        toppedUp: account.balance.toppedUp
      } : void 0,
      subscription: account.subscription ? { plan: account.subscription.plan, windows: account.subscription.windows } : void 0
    }))
  };
}

// src/host/api.ts
var API_PREFIX = "/token-usage-statistic/";
var ROUTES = {
  summary: `${API_PREFIX}api/summary`,
  accounts: `${API_PREFIX}api/accounts`,
  daily: `${API_PREFIX}api/daily`,
  exportDaily: `${API_PREFIX}api/export/daily.csv`,
  exportSessions: `${API_PREFIX}api/export/sessions.csv`,
  exportJson: `${API_PREFIX}api/export.json`
};
function parseDays(value, fallback = 30) {
  if (value === null || value === "") return fallback;
  if (value === "all") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), 3650);
}
function parseLimit(value, fallback, max) {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}
function isLoopbackRequest(request) {
  const address = request.socket?.remoteAddress;
  if (typeof address !== "string" || address === "") return true;
  return address === "::1" || address.startsWith("127.") || address.startsWith("::ffff:127.");
}
function writeHeaders(response, status, headers) {
  response.writeHead(status, headers);
}
function sendJson(response, status, body, method = "GET") {
  const payload = JSON.stringify(body);
  writeHeaders(response, status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": String(Buffer.byteLength(payload))
  });
  response.end(method === "HEAD" ? void 0 : payload);
}
function sendDownload(response, contentType, filename, payload, method = "GET") {
  writeHeaders(response, 200, {
    "content-type": contentType,
    "cache-control": "no-store",
    "content-disposition": `attachment; filename="${filename}"`,
    "content-length": String(Buffer.byteLength(payload))
  });
  response.end(method === "HEAD" ? void 0 : payload);
}
var IDLE_BACKFILL = {
  state: "idle",
  sessions: 0,
  events: 0,
  skipped: 0,
  inherited: 0,
  startedAt: null,
  finishedAt: null,
  error: null
};
function createHttpHandler(dependencies) {
  const now = dependencies.now ?? Date.now;
  return async function handle(request, response) {
    const method = typeof request.method === "string" ? request.method : "GET";
    let url;
    try {
      url = new URL(typeof request.url === "string" ? request.url : "/", "http://localhost");
    } catch {
      sendJson(response, 400, { error: "bad-request" }, method);
      return;
    }
    if (!isLoopbackRequest(request)) {
      sendJson(response, 403, { error: "loopback-only" }, method);
      return;
    }
    if (method !== "GET" && method !== "HEAD") {
      sendJson(response, 405, { error: "method-not-allowed" }, method);
      return;
    }
    try {
      switch (url.pathname) {
        case ROUTES.summary: {
          void dependencies.sessionNames.refresh(dependencies.store.sessionIds());
          const snapshot = dependencies.store.snapshot({
            days: parseDays(url.searchParams.get("days")),
            sessionLimit: parseLimit(url.searchParams.get("sessions"), 12, 100),
            recentLimit: parseLimit(url.searchParams.get("recent"), 20, 100),
            now: now(),
            backfill: dependencies.backfill(),
            budgets: dependencies.budgets(now()),
            refreshMs: dependencies.refreshMs,
            sessionNames: dependencies.sessionNames
          });
          sendJson(response, 200, snapshot, method);
          return;
        }
        case ROUTES.accounts: {
          if (url.searchParams.get("refresh") === "1") dependencies.refreshAccounts();
          sendJson(response, 200, dependencies.accounts(), method);
          return;
        }
        case ROUTES.daily: {
          void dependencies.sessionNames.refresh(dependencies.store.sessionIds());
          const snapshot = dependencies.store.dailyDetails({
            days: parseDays(url.searchParams.get("days")),
            sessionLimit: parseLimit(url.searchParams.get("sessions"), 12, 100),
            now: now(),
            sessionNames: dependencies.sessionNames
          });
          sendJson(response, 200, snapshot, method);
          return;
        }
        case ROUTES.exportDaily: {
          sendDownload(response, "text/csv; charset=utf-8", "token-usage-daily.csv", dailyCsv(dependencies.store), method);
          return;
        }
        case ROUTES.exportSessions: {
          sendDownload(response, "text/csv; charset=utf-8", "token-usage-sessions.csv", sessionsCsv(dependencies.store), method);
          return;
        }
        case ROUTES.exportJson: {
          const body = jsonExport({
            store: dependencies.store,
            accounts: dependencies.accounts().accounts,
            budgets: dependencies.budgets(now()),
            exportedAt: now()
          });
          sendJson(response, 200, body, method);
          return;
        }
        default:
          sendJson(response, 404, { error: "not-found", path: url.pathname }, method);
      }
    } catch (error) {
      sendJson(response, 500, { error: "internal", message: error instanceof Error ? error.message : String(error) }, method);
    }
  };
}

// src/host/accounts/registry.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// src/host/accounts/net.ts
var MAX_BYTES = 1024 * 1024;
var AccountError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "AccountError";
    this.code = code;
  }
};
function isLoopbackHost(hostname) {
  return hostname === "127.0.0.1" || hostname === "::1" || hostname === "localhost";
}
function statusCodeFor(status) {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 429) return "rate-limited";
  if (status === 404 || status === 405) return "unsupported";
  if (status >= 500) return "unavailable";
  return "invalid-response";
}
async function fetchJson(url, options = {}, fetchImpl = fetch) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new AccountError("invalid-url", "account endpoint is not a valid URL");
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw new AccountError("invalid-url", "account endpoint must not embed credentials");
  }
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopbackHost(parsed.hostname))) {
    throw new AccountError("insecure-url", "account endpoint must use HTTPS");
  }
  let response;
  try {
    response = await fetchImpl(parsed.href, {
      method: "GET",
      headers: { accept: "application/json", ...options.headers ?? {} },
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs ?? 15e3)
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") throw new AccountError("timeout", "account endpoint timed out");
    throw new AccountError("network", "account endpoint is unreachable");
  }
  if (response.status >= 300 && response.status < 400) {
    throw new AccountError("redirect", "account endpoint redirected; refusing to follow");
  }
  if (!response.ok) {
    throw new AccountError(statusCodeFor(response.status), `account endpoint returned HTTP ${response.status}`);
  }
  const text = await response.text();
  if (text.length > (options.maxBytes ?? MAX_BYTES)) {
    throw new AccountError("too-large", "account response exceeded the size limit");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new AccountError("invalid-json", "account endpoint returned invalid JSON");
  }
}

// src/host/accounts/schemes.ts
function pointerValue(root, pointer) {
  if (pointer === void 0 || pointer === "") return root;
  if (!pointer.startsWith("/")) return void 0;
  let current = root;
  for (const raw of pointer.slice(1).split("/")) {
    const key = raw.replaceAll("~1", "/").replaceAll("~0", "~");
    if (Array.isArray(current)) {
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0) return void 0;
      current = current[index];
    } else if (current !== null && typeof current === "object") {
      current = current[key];
    } else {
      return void 0;
    }
  }
  return current;
}
function numberOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
function stringOrNull(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
function emptyBalance(currency = null) {
  return { currency, total: null, used: null, limit: null, granted: null, toppedUp: null, available: null };
}
function schemeForProvider(providerId, baseURL) {
  const id = providerId.toLowerCase();
  let host = "";
  if (typeof baseURL === "string") {
    try {
      host = new URL(baseURL).hostname.toLowerCase();
    } catch {
      host = "";
    }
  }
  if (id.includes("deepseek") || host === "api.deepseek.com") return "deepseek";
  if (id.includes("moonshot") || host.includes("moonshot")) return "moonshot";
  if (id.includes("zai") || id.includes("zhipu") || host.includes("z.ai") || host.includes("bigmodel.cn")) return "zai";
  if (id.includes("openrouter") || host.includes("openrouter.ai")) return "openrouter";
  if (id.includes("orcarouter") || host.includes("orcarouter")) return "orcarouter";
  return null;
}
function originOf(baseURL) {
  try {
    return new URL(baseURL);
  } catch {
    throw new AccountError("invalid-url", "provider base URL is invalid");
  }
}
function schemeURL(scheme, baseURL) {
  const base = originOf(baseURL);
  switch (scheme) {
    case "deepseek":
      return new URL("/user/balance", base.origin).href;
    case "moonshot":
      return new URL("/v1/users/me/balance", base.origin).href;
    case "zai":
      return new URL("/api/paas/v4/balance", base.origin).href;
    case "openrouter":
      return new URL("/api/v1/credits", base.origin).href;
    case "orcarouter": {
      const pathname = base.pathname.replace(/\/+$/, "");
      const prefix = pathname === "" ? "/v1" : pathname.endsWith("/v1") ? pathname : `${pathname}/v1`;
      return new URL(`${prefix}/balance`, base.origin).href;
    }
  }
}
function walletTotal(entries, currency) {
  if (!Array.isArray(entries)) return 0;
  let total = 0;
  for (const entry of entries) {
    if (entry === null || typeof entry !== "object") continue;
    const record = entry;
    const entryCurrency = stringOrNull(record.unit) ?? stringOrNull(record.currency) ?? currency;
    if (entryCurrency.toUpperCase() !== currency) continue;
    total += numberOrNull(record.balance_usd ?? record.balance ?? record.amount) ?? 0;
  }
  return total;
}
function parseSchemeBalance(scheme, json) {
  const body = json !== null && typeof json === "object" ? json : {};
  if (scheme === "deepseek") {
    const infos = Array.isArray(body.balance_infos) ? body.balance_infos : [];
    const info = infos.find((entry) => entry?.currency === "CNY") ?? infos[0];
    const total = numberOrNull(info?.total_balance);
    if (total === null) throw new AccountError("invalid-response", "DeepSeek balance response is missing total_balance");
    return {
      currency: stringOrNull(info?.currency),
      total,
      used: null,
      limit: null,
      granted: numberOrNull(info?.granted_balance),
      toppedUp: numberOrNull(info?.topped_up_balance),
      available: typeof body.is_available === "boolean" ? body.is_available : total > 0
    };
  }
  if (scheme === "moonshot") {
    const data = body.data ?? {};
    const available = numberOrNull(data.available_balance);
    if (available === null) throw new AccountError("invalid-response", "Moonshot balance response is missing available_balance");
    return {
      currency: stringOrNull(data.currency),
      total: available,
      used: null,
      limit: null,
      granted: numberOrNull(data.voucher_balance),
      toppedUp: numberOrNull(data.cash_balance),
      available: available > 0
    };
  }
  if (scheme === "zai") {
    const data = body.data ?? {};
    const total = numberOrNull(data.total_balance) ?? numberOrNull(data.available_balance);
    if (total === null) throw new AccountError("invalid-response", "Z.ai balance response is missing total_balance");
    return {
      currency: stringOrNull(data.currency),
      total,
      used: null,
      limit: null,
      granted: null,
      toppedUp: numberOrNull(data.available_balance),
      available: total > 0
    };
  }
  if (scheme === "openrouter") {
    const totalCredits = numberOrNull(body.data?.total_credits);
    const totalUsage = numberOrNull(body.data?.total_usage);
    if (totalCredits === null || totalUsage === null) {
      throw new AccountError("invalid-response", "OpenRouter credits response is missing totals");
    }
    const remaining2 = totalCredits - totalUsage;
    return {
      currency: "USD",
      total: remaining2,
      used: totalUsage,
      limit: totalCredits,
      granted: null,
      toppedUp: null,
      available: remaining2 > 0
    };
  }
  const currency = stringOrNull(body.unit)?.toUpperCase() ?? null;
  const paid = numberOrNull(body.paid_balance);
  if (currency === null || paid === null) throw new AccountError("invalid-response", "OrcaRouter wallet response is missing unit or paid_balance");
  const remaining = paid + walletTotal(body.free_credit, currency) + walletTotal(body.promo_credits, currency);
  return {
    currency,
    total: remaining,
    used: null,
    limit: null,
    granted: null,
    toppedUp: null,
    available: remaining > 0
  };
}
function parseGenericBalance(json, mapping) {
  const balance = emptyBalance(stringOrNull(pointerValue(json, mapping.currency)));
  balance.total = numberOrNull(pointerValue(json, mapping.total));
  balance.used = numberOrNull(pointerValue(json, mapping.used));
  balance.limit = numberOrNull(pointerValue(json, mapping.limit));
  balance.granted = numberOrNull(pointerValue(json, mapping.granted));
  balance.toppedUp = numberOrNull(pointerValue(json, mapping.toppedUp));
  const available = pointerValue(json, mapping.available);
  balance.available = typeof available === "boolean" ? available : balance.total !== null ? balance.total > 0 : null;
  if (balance.total === null && balance.used === null && balance.limit === null) {
    throw new AccountError("invalid-response", "generic balance mapping produced no numeric value");
  }
  return balance;
}
function windowOf(json, index, mapping) {
  const id = stringOrNull(pointerValue(json, mapping.fields.id)) ?? `window-${index + 1}`;
  const label = stringOrNull(pointerValue(json, mapping.fields.label)) ?? id;
  return {
    id,
    label,
    used: numberOrNull(pointerValue(json, mapping.fields.used)),
    limit: numberOrNull(pointerValue(json, mapping.fields.limit)),
    remaining: numberOrNull(pointerValue(json, mapping.fields.remaining)),
    unit: stringOrNull(pointerValue(json, mapping.fields.unit)),
    resetAt: stringOrNull(pointerValue(json, mapping.fields.resetAt))
  };
}
function parseGenericSubscription(json, mapping) {
  const windows = pointerValue(json, mapping.windows);
  if (!Array.isArray(windows)) throw new AccountError("invalid-response", "generic subscription mapping did not select a window array");
  return {
    plan: stringOrNull(pointerValue(json, mapping.plan)),
    windows: windows.map((entry, index) => windowOf(entry, index, mapping))
  };
}

// src/host/accounts/registry.ts
var MIN_REFRESH_MS = 6e4;
function clampRefresh(value, fallback) {
  return Number.isFinite(value) && value >= MIN_REFRESH_MS ? Math.floor(value) : fallback;
}
function emptyAccount(definition) {
  return {
    id: definition.id,
    displayName: definition.displayName,
    mode: definition.mode,
    adapter: definition.adapter,
    configured: false,
    status: "unconfigured",
    stale: false,
    fetchedAt: null,
    lastAttemptAt: null,
    lastError: null,
    source: { kind: definition.adapter === "host" ? "host-service" : definition.adapter === "http" ? "http" : "unsupported", ...definition.baseURL === void 0 ? {} : { origin: definition.baseURL } }
  };
}
function walletNumber(value) {
  return numberOrNull(value);
}
function balanceOfWallets(wallets, bonus) {
  const sums = /* @__PURE__ */ new Map();
  const add = (entries, key) => {
    for (const entry2 of entries) {
      if (entry2 === null || typeof entry2 !== "object") continue;
      const record = entry2;
      const currency2 = stringOrNull(record.currency) ?? "CNY";
      const amount = walletNumber(record.balance) ?? 0;
      const current = sums.get(currency2) ?? { total: 0, granted: 0 };
      current[key] += amount;
      sums.set(currency2, current);
    }
  };
  add(wallets, "total");
  add(bonus, "granted");
  const entry = [...sums.entries()].find(([currency2]) => currency2 === "CNY") ?? [...sums.entries()][0];
  if (entry === void 0) return { currency: null, total: null, used: null, limit: null, granted: null, toppedUp: null, available: null };
  const [currency, value] = entry;
  const total = value.total + value.granted;
  return {
    currency,
    total,
    used: null,
    limit: null,
    granted: value.granted,
    toppedUp: value.total,
    available: total > 0
  };
}
var AccountRegistry = class {
  options;
  now;
  views = /* @__PURE__ */ new Map();
  definitions = [];
  refreshing = false;
  disposed = false;
  timer;
  firstTimer;
  constructor(options) {
    this.options = options;
    this.now = options.now ?? Date.now;
    this.options.config = {
      ...options.config,
      refreshMs: clampRefresh(options.config.refreshMs, 6e5)
    };
  }
  /** Load the previous snapshot so the panel has data before the first query. */
  async loadCache() {
    try {
      const text = await readFile(path.join(this.options.dataDir, "accounts.json"), "utf8");
      const parsed = JSON.parse(text);
      if (parsed.version !== 1 || !Array.isArray(parsed.accounts)) return;
      for (const account of parsed.accounts) {
        if (account !== null && typeof account === "object" && typeof account.id === "string") {
          this.views.set(account.id, { ...account, stale: account.fetchedAt !== null });
        }
      }
    } catch {
    }
  }
  /** Whether a refresh cycle is running. */
  isRefreshing() {
    return this.refreshing;
  }
  /** The wire snapshot. */
  snapshot() {
    const order = this.definitions.length > 0 ? this.definitions.map((entry) => entry.id) : [...this.views.keys()];
    const accounts = order.map((id) => this.views.get(id)).filter((entry) => entry !== void 0);
    for (const view of this.views.values()) if (!order.includes(view.id)) accounts.push(view);
    return {
      schemaVersion: 1,
      generatedAt: this.now(),
      refreshMs: this.options.config.refreshMs,
      refreshing: this.refreshing,
      accounts
    };
  }
  /** Refresh every account once; concurrent calls share the running cycle. */
  async refresh() {
    if (this.refreshing || this.disposed) return;
    this.refreshing = true;
    try {
      const definitions = await this.discover();
      this.definitions = definitions;
      for (const definition of definitions) {
        if (!this.views.has(definition.id)) this.views.set(definition.id, emptyAccount(definition));
      }
      await Promise.all(definitions.map((definition) => this.queryOne(definition)));
      await this.persist();
    } finally {
      this.refreshing = false;
    }
  }
  /** Start the initial and periodic refresh; returns its disposer. */
  start() {
    const schedule = () => {
      if (this.disposed) return;
      void this.refresh();
    };
    this.firstTimer = setTimeout(schedule, 1500);
    this.timer = setInterval(schedule, this.options.config.refreshMs);
    return () => {
      this.disposed = true;
      if (this.firstTimer !== void 0) clearTimeout(this.firstTimer);
      if (this.timer !== void 0) clearInterval(this.timer);
    };
  }
  async discover() {
    const definitions = [];
    const explicit = new Map(this.options.config.monitors.map((monitor) => [monitor.id, monitor]));
    if (this.options.services.get("deepseekAccount") !== void 0) {
      definitions.push({
        id: "deepseek-account",
        displayName: "DeepSeek Account",
        mode: "balance",
        adapter: "host"
      });
    }
    const settings = this.options.services.get("settings");
    if (settings !== void 0 && typeof settings.describe === "function") {
      let descriptors = [];
      try {
        descriptors = settings.describe({ redactSecrets: true });
      } catch {
        descriptors = [];
      }
      const piAI = descriptors.find((entry) => String(entry.ns).endsWith("llm-pi-ai"));
      const providers = piAI?.value !== null && typeof piAI?.value === "object" ? piAI.value.providers : void 0;
      if (providers !== null && typeof providers === "object" && !Array.isArray(providers)) {
        for (const [id, raw] of Object.entries(providers)) {
          if (raw === null || typeof raw !== "object") continue;
          const profile = raw;
          const baseURL = stringOrNull(profile.baseURL) ?? void 0;
          const credentialRef = stringOrNull(profile.apiKeyEnv) ?? void 0;
          const displayName = stringOrNull(profile.displayName) ?? id;
          const scheme = schemeForProvider(id, baseURL);
          definitions.push(
            scheme === null ? {
              id,
              displayName,
              mode: "balance",
              adapter: "unsupported",
              baseURL,
              credentialRef,
              reason: "no public balance interface"
            } : { id, displayName, mode: "balance", adapter: "http", baseURL, credentialRef, scheme }
          );
        }
      }
      const deepseek = descriptors.find((entry) => String(entry.ns).endsWith("llm-deepseek"));
      if (deepseek !== void 0) {
        const value = deepseek.value !== null && typeof deepseek.value === "object" ? deepseek.value : {};
        definitions.push({
          id: "deepseek-api",
          displayName: "DeepSeek API",
          mode: "balance",
          adapter: "http",
          baseURL: stringOrNull(value.baseURL) ?? "https://api.deepseek.com",
          credentialRef: stringOrNull(value.apiKeyEnv) ?? "DEEPSEEK_API_KEY",
          scheme: "deepseek"
        });
      }
    }
    for (const monitor of explicit.values()) {
      const index = definitions.findIndex((entry) => entry.id === monitor.id);
      const definition = {
        id: monitor.id,
        displayName: monitor.displayName ?? monitor.id,
        mode: monitor.mode,
        adapter: "http",
        baseURL: monitor.baseURL,
        credentialRef: monitor.credentialRef,
        scheme: monitor.scheme ?? schemeForProvider(monitor.id, monitor.baseURL) ?? void 0,
        headers: monitor.headers,
        balance: monitor.balance,
        subscription: monitor.subscription,
        timeoutMs: monitor.timeoutMs
      };
      if (index >= 0) definitions[index] = definition;
      else definitions.push(definition);
    }
    const seen = /* @__PURE__ */ new Set();
    return definitions.filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
  }
  async queryOne(definition) {
    const previous = this.views.get(definition.id);
    const now = this.now();
    const base = previous ?? emptyAccount(definition);
    const started = { ...base, adapter: definition.adapter, mode: definition.mode, lastAttemptAt: now };
    try {
      const outcome = await this.query(definition);
      if (outcome === "unconfigured") {
        this.views.set(definition.id, {
          ...started,
          configured: false,
          status: "unconfigured",
          stale: false,
          lastError: null
        });
        return;
      }
      if (outcome === "unsupported") {
        this.views.set(definition.id, {
          ...started,
          configured: false,
          status: "unsupported",
          stale: false,
          lastError: definition.reason ?? null
        });
        return;
      }
      this.views.set(definition.id, {
        ...started,
        configured: true,
        status: "ok",
        stale: false,
        fetchedAt: now,
        lastError: null,
        ...outcome
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.options.log?.(`account ${definition.id} refresh failed: ${message}`);
      this.views.set(definition.id, {
        ...started,
        status: "error",
        stale: previous?.fetchedAt !== null && previous?.fetchedAt !== void 0,
        lastError: message
      });
    }
  }
  async query(definition) {
    if (definition.adapter === "unsupported") return "unsupported";
    if (definition.adapter === "host") return this.queryHost();
    return this.queryHTTP(definition);
  }
  async queryHost() {
    const service = this.options.services.get("deepseekAccount");
    if (service === void 0) return "unsupported";
    const state = await service.getState();
    if (state?.status !== "credential-stored") return "unconfigured";
    const balance = await service.getBalance({
      version: this.options.version,
      locale: "en",
      timezoneOffsetSeconds: -(/* @__PURE__ */ new Date()).getTimezoneOffset() * 60
    });
    if (balance === null) return "unconfigured";
    if (balance.status !== "ready") throw new AccountError("account-failed", "the DeepSeek account balance query failed");
    return { balance: balanceOfWallets(balance.value ?? [], balance.bonusWallets ?? []) };
  }
  async queryHTTP(definition) {
    if (definition.baseURL === void 0 || definition.baseURL === "") {
      throw new AccountError("invalid-config", "account monitor has no baseURL");
    }
    const credentials = this.options.services.get("credentials");
    let apiKey;
    if (definition.credentialRef !== void 0 && definition.credentialRef !== "") {
      if (credentials === void 0) return "unconfigured";
      const info = await credentials.describe(definition.credentialRef);
      if (!info.configured) return "unconfigured";
      const resolved = await credentials.resolve(definition.credentialRef);
      if (resolved === void 0 || resolved.value === "") return "unconfigured";
      apiKey = resolved.value;
    }
    const headers = { ...definition.headers ?? {} };
    if (apiKey !== void 0) headers.authorization = `Bearer ${apiKey}`;
    if (definition.mode === "subscription") {
      if (definition.subscription === void 0) return "unsupported";
      const json2 = await fetchJson(definition.baseURL, { headers, timeoutMs: definition.timeoutMs ?? this.options.config.timeoutMs }, this.options.fetchImpl);
      return { subscription: parseGenericSubscription(json2, definition.subscription) };
    }
    const url = definition.scheme === void 0 ? definition.baseURL : schemeURL(definition.scheme, definition.baseURL);
    const json = await fetchJson(url, { headers, timeoutMs: definition.timeoutMs ?? this.options.config.timeoutMs }, this.options.fetchImpl);
    const balance = definition.scheme === void 0 ? definition.balance === void 0 ? void 0 : parseGenericBalance(json, definition.balance) : parseSchemeBalance(definition.scheme, json);
    if (balance === void 0) return "unsupported";
    return { balance };
  }
  async persist() {
    const file = path.join(this.options.dataDir, "accounts.json");
    const payload = { version: 1, updatedAt: this.now(), accounts: this.snapshot().accounts };
    try {
      await mkdir(this.options.dataDir, { recursive: true });
      await writeFile(file, `${JSON.stringify(payload)}
`, "utf8");
    } catch (error) {
      this.options.log?.(`account cache could not be written: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};
function emptyAccountsPayload(refreshMs = 6e5) {
  return { schemaVersion: 1, generatedAt: Date.now(), refreshMs, refreshing: false, accounts: [] };
}
function readMonitors(value) {
  if (!Array.isArray(value)) return [];
  const monitors = [];
  for (const raw of value) {
    if (raw === null || typeof raw !== "object") continue;
    const record = raw;
    const id = stringOrNull(record.id);
    const baseURL = stringOrNull(record.baseURL);
    const mode = record.mode === "subscription" ? "subscription" : "balance";
    if (id === null || baseURL === null) continue;
    monitors.push({
      id,
      mode,
      baseURL,
      ...stringOrNull(record.displayName) === null ? {} : { displayName: stringOrNull(record.displayName) },
      ...stringOrNull(record.credentialRef) === null ? {} : { credentialRef: stringOrNull(record.credentialRef) },
      ...record.scheme === "deepseek" || record.scheme === "moonshot" || record.scheme === "zai" || record.scheme === "openrouter" || record.scheme === "orcarouter" ? { scheme: record.scheme } : {},
      ...record.headers !== null && typeof record.headers === "object" ? { headers: record.headers } : {},
      ...record.balance !== null && typeof record.balance === "object" ? { balance: record.balance } : {},
      ...record.subscription !== null && typeof record.subscription === "object" ? { subscription: record.subscription } : {},
      ...numberOrNull(record.timeoutMs) === null ? {} : { timeoutMs: numberOrNull(record.timeoutMs) }
    });
  }
  return monitors;
}

// src/host/cost.ts
function createCostAccumulator() {
  return { pricedCalls: 0, unpricedCalls: 0, amounts: /* @__PURE__ */ new Map(), ruleIds: /* @__PURE__ */ new Set() };
}
function applyCostSample(accumulator, sample, direction = 1) {
  if (sample.counted !== true) return;
  if (sample.complete !== true) {
    accumulator.unpricedCalls = Math.max(0, accumulator.unpricedCalls + direction);
    return;
  }
  accumulator.pricedCalls = Math.max(0, accumulator.pricedCalls + direction);
  accumulator.ruleIds.add(sample.ruleId);
  const previous = accumulator.amounts.get(sample.currency) ?? 0;
  const next = previous + direction * sample.amount;
  if (next === 0) accumulator.amounts.delete(sample.currency);
  else accumulator.amounts.set(sample.currency, next);
}
function mergeCost(into, from) {
  into.pricedCalls += from.pricedCalls;
  into.unpricedCalls += from.unpricedCalls;
  for (const [currency, amount] of from.amounts) {
    const next = (into.amounts.get(currency) ?? 0) + amount;
    if (next === 0) into.amounts.delete(currency);
    else into.amounts.set(currency, next);
  }
  if (from.pricedCalls > 0) for (const ruleId of from.ruleIds) into.ruleIds.add(ruleId);
  return into;
}
function roundAmount(amount) {
  return Math.round(amount * 1e6) / 1e6;
}
function renderCost(accumulator) {
  const complete = accumulator.unpricedCalls === 0 && accumulator.amounts.size <= 1;
  const entry = complete ? [...accumulator.amounts.entries()][0] : void 0;
  return {
    amount: complete ? entry === void 0 ? 0 : roundAmount(entry[1]) : null,
    currency: entry?.[0] ?? null,
    complete,
    pricedCalls: accumulator.pricedCalls,
    unpricedCalls: accumulator.unpricedCalls,
    ruleIds: [...accumulator.ruleIds].sort()
  };
}
function renderSampleCost(sample) {
  if (sample.counted !== true) {
    return { amount: 0, currency: null, complete: true, pricedCalls: 0, unpricedCalls: 0, ruleIds: [] };
  }
  if (sample.complete !== true) {
    return { amount: null, currency: null, complete: false, pricedCalls: 0, unpricedCalls: 1, ruleIds: [] };
  }
  return {
    amount: roundAmount(sample.amount),
    currency: sample.currency,
    complete: true,
    pricedCalls: 1,
    unpricedCalls: 0,
    ruleIds: [sample.ruleId]
  };
}

// src/host/usage.ts
function count(value) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.round(number);
}
function dayKey(time) {
  const date = new Date(Number.isFinite(time) ? time : Date.now());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
function emptyBuckets() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
}
function bucketsOf(usage) {
  const source = usage !== null && typeof usage === "object" ? usage : {};
  return {
    input: count(source.inputTokens),
    output: count(source.outputTokens),
    cacheRead: count(source.cacheReadTokens),
    cacheWrite: count(source.cacheWriteTokens)
  };
}
function totalTokens(buckets) {
  return buckets.input + buckets.output + buckets.cacheRead + buckets.cacheWrite;
}
function cacheHitRate(buckets) {
  const prompt = buckets.input + buckets.cacheRead + buckets.cacheWrite;
  if (prompt <= 0) return null;
  return Math.round(buckets.cacheRead / prompt * 1e3) / 10;
}
function hasTokens(buckets) {
  return totalTokens(buckets) > 0;
}
function sampleDraftOf(event) {
  if (event === null || typeof event !== "object") return null;
  const data = event.data;
  if (data === void 0 || data === null || typeof data !== "object") return null;
  if (event.type === "assistant/chunk") {
    const chunk = data.chunk;
    if (chunk === null || typeof chunk !== "object" || chunk.type !== "usage") return null;
    if (chunk.usage === null || typeof chunk.usage !== "object") return null;
    return { key: `${Number(data.turn)}:${Number(data.step)}`, kind: "assistant", usage: chunk.usage };
  }
  if (event.type === "assistant/message") {
    if (data.usage === null || data.usage === void 0 || typeof data.usage !== "object") return null;
    return { key: `${Number(data.turn)}:${Number(data.step)}`, kind: "assistant", usage: data.usage };
  }
  if (event.type === "compaction/summary") {
    if (data.usage === null || data.usage === void 0 || typeof data.usage !== "object") return null;
    const id = typeof data.compactionId === "string" && data.compactionId.length > 0 ? data.compactionId : String(event.seq);
    return { key: `compaction:${id}`, kind: "compaction", usage: data.usage };
  }
  return null;
}
function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return "";
}
function routeOf(event) {
  if (event === null || typeof event !== "object") return null;
  const data = event.data;
  if (data === void 0 || data === null || typeof data !== "object") return null;
  const source = data.message?.source;
  const sourceProvider = firstString(source?.provider);
  const sourceModel = firstString(source?.model);
  if (sourceModel !== "") return { provider: sourceProvider || "unknown", model: sourceModel };
  const directProvider = firstString(data.provider);
  const directModel = firstString(data.model);
  if (directModel !== "") return { provider: directProvider || "unknown", model: directModel };
  const config = data.header?.config;
  const headerProvider = firstString(config?.provider);
  const headerModel = firstString(config?.model);
  if (headerModel !== "") return { provider: headerProvider || "unknown", model: headerModel };
  return null;
}
function makeSample(input) {
  const buckets = bucketsOf(input.usage);
  if (!hasTokens(buckets)) return null;
  const seq = Number.isFinite(input.seq) ? Math.floor(input.seq) : -1;
  if (seq < 0) return null;
  const time = Number.isFinite(input.time) ? input.time : Date.now();
  return {
    version: 2,
    sessionId: input.sessionId,
    seq,
    time,
    day: dayKey(time),
    sampleKey: input.key,
    kind: input.kind,
    provider: input.provider || "unknown",
    model: input.model || "unknown",
    buckets
  };
}
function isV2(value) {
  return value.version === 2 && typeof value.sampleKey === "string" && typeof value.kind === "string";
}
function sanitizeSample(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw;
  const sessionId = typeof value.sessionId === "string" && value.sessionId.length > 0 ? value.sessionId : "";
  if (sessionId === "") return null;
  const seq = Number.isFinite(value.seq) ? Math.floor(value.seq) : -1;
  if (seq < 0) return null;
  const time = Number.isFinite(value.time) ? value.time : Date.now();
  if (isV2(value)) {
    const buckets2 = value.buckets;
    if (buckets2 === null || typeof buckets2 !== "object") return null;
    const normalized = {
      input: count(buckets2.input),
      output: count(buckets2.output),
      cacheRead: count(buckets2.cacheRead),
      cacheWrite: count(buckets2.cacheWrite)
    };
    if (!hasTokens(normalized)) return null;
    return {
      version: 2,
      sessionId,
      seq,
      time,
      day: typeof value.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.day) ? value.day : dayKey(time),
      sampleKey: value.sampleKey,
      kind: value.kind === "compaction" ? "compaction" : "assistant",
      provider: typeof value.provider === "string" && value.provider.length > 0 ? value.provider : "unknown",
      model: typeof value.model === "string" && value.model.length > 0 ? value.model : "unknown",
      buckets: normalized
    };
  }
  const usage = value.usage;
  if (usage === null || typeof usage !== "object") return null;
  const buckets = bucketsOf(usage);
  if (!hasTokens(buckets)) return null;
  return {
    version: 2,
    sessionId,
    seq,
    time,
    day: typeof value.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.day) ? value.day : dayKey(time),
    sampleKey: `assistant:${seq}`,
    kind: "assistant",
    provider: typeof value.provider === "string" && value.provider.length > 0 ? value.provider : "unknown",
    model: typeof value.model === "string" && value.model.length > 0 ? value.model : "unknown",
    buckets
  };
}

// src/host/budgets.ts
var WARN_AT = 80;
function resolveBudgetConfig(value) {
  const config = value !== null && typeof value === "object" ? value : {};
  const currency = typeof config.currency === "string" && /^[A-Z]{3}$/.test(config.currency) ? config.currency : "USD";
  const limit = (raw) => {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  return { currency, daily: limit(config.daily), monthly: limit(config.monthly) };
}
function windowOf2(limit, currency, accumulator) {
  const rendered = renderCost(accumulator);
  const sameCurrency = rendered.currency === null || rendered.currency === currency;
  const costComplete = rendered.complete && sameCurrency;
  const spend = rendered.amount;
  const percent = limit !== null && spend !== null ? Math.round(spend / limit * 1e3) / 10 : null;
  if (!costComplete) {
    return { limit, currency, spend: null, percent: null, costComplete, level: null };
  }
  const level = limit !== null && percent !== null ? percent >= 100 ? "exceeded" : percent >= WARN_AT ? "warn" : "ok" : null;
  return {
    limit,
    currency,
    spend,
    percent,
    costComplete,
    level
  };
}
function budgetState(store, config, now = Date.now()) {
  const day = dayKey(now);
  const month = day.slice(0, 7);
  const daily = store.costBetween(day, day);
  const monthly = store.costBetween(`${month}-01`, day);
  return {
    currency: config.currency,
    daily: windowOf2(config.daily, config.currency, daily),
    monthly: windowOf2(config.monthly, config.currency, monthly)
  };
}

// src/host/backfill.ts
var Backfill = class {
  options;
  running = false;
  status = {
    state: "idle",
    sessions: 0,
    events: 0,
    skipped: 0,
    inherited: 0,
    startedAt: null,
    finishedAt: null,
    error: null
  };
  constructor(options) {
    this.options = options;
  }
  /** Current progress (a detached copy). */
  getStatus() {
    return { ...this.status };
  }
  publish(patch) {
    this.status = { ...this.status, ...patch };
    this.options.onChange?.(this.getStatus());
  }
  /** Run one scan; concurrent calls are no-ops. */
  async run() {
    if (this.running) return;
    this.running = true;
    const now = this.options.now ?? Date.now;
    this.publish({ state: "running", startedAt: now(), finishedAt: null, error: null, sessions: 0, events: 0, skipped: 0, inherited: 0 });
    try {
      const sessions = await this.options.persistence.list();
      let cursor = 0;
      let events = 0;
      while (cursor < sessions.length) {
        const batch = sessions.slice(cursor, cursor + 8);
        cursor += batch.length;
        await Promise.all(batch.map((session) => this.scanOne(session)));
        events = this.status.events;
        this.publish({ events });
      }
      this.publish({ state: "done", events, finishedAt: now() });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.options.log?.(`historical scan failed: ${message}`);
      this.publish({ state: "error", error: message, finishedAt: now() });
    } finally {
      this.running = false;
    }
  }
  async scanOne(session) {
    const sessionId = typeof session?.header?.id === "string" ? session.header.id : "";
    if (sessionId === "") return;
    const last = this.options.lastSeqOf(sessionId);
    const ahead = typeof session.eventCount === "number" ? session.eventCount > last + 1 : true;
    if (!ahead) {
      this.publish({ skipped: this.status.skipped + 1 });
      return;
    }
    let handle;
    try {
      handle = await this.options.persistence.open(sessionId, "read");
      const inherited = Number.isSafeInteger(handle.inheritedEventCount) && (handle.inheritedEventCount ?? 0) > 0 ? handle.inheritedEventCount : 0;
      const offset = Math.max(last + 1, inherited);
      if (inherited > 0 && inherited > last + 1) this.publish({ inherited: this.status.inherited + 1 });
      const result = await handle.read(offset);
      for (const event of result.events) {
        if (Number.isFinite(event.seq) && event.seq < offset) continue;
        this.options.onEvent(sessionId, event);
        this.publish({ events: this.status.events + 1 });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.options.log?.(`historical scan skipped ${sessionId}: ${message}`);
    } finally {
      if (handle !== void 0) {
        try {
          await handle.close();
        } catch {
        }
      }
    }
    this.publish({ sessions: this.status.sessions + 1 });
  }
};

// src/host/collector.ts
var Collector = class {
  routes = /* @__PURE__ */ new Map();
  maxSessions;
  constructor(options = {}) {
    const max = options.maxSessions ?? 512;
    this.maxSessions = Number.isFinite(max) && max > 0 ? Math.floor(max) : 512;
  }
  /** Remember one session's effective request route. */
  remember(sessionId, route) {
    if (route.model === "" || route.model === "unknown") return;
    if (!this.routes.has(sessionId) && this.routes.size >= this.maxSessions) {
      const oldest = this.routes.keys().next().value;
      if (oldest !== void 0) this.routes.delete(oldest);
    }
    this.routes.set(sessionId, route);
  }
  /** Forget one session's fallback route. */
  forget(sessionId) {
    if (typeof sessionId === "string") this.routes.delete(sessionId);
  }
  /** Turn one committed session event into a sample, if it carries usage. */
  observe(session, event) {
    const sessionId = session !== void 0 && typeof session.id === "string" ? session.id : "";
    if (sessionId === "" || event === void 0) return null;
    if (event.type === "request/header") {
      const route2 = routeOf(event);
      if (route2 !== null) this.remember(sessionId, route2);
      return null;
    }
    const draft = sampleDraftOf(event);
    if (draft === null) return null;
    const named = routeOf(event);
    if (named !== null) this.remember(sessionId, named);
    const route = named ?? this.routes.get(sessionId) ?? { provider: "unknown", model: "unknown" };
    const kind = draft.kind;
    const sample = makeSample({
      sessionId,
      seq: event.seq,
      time: event.time,
      key: draft.key,
      kind,
      provider: route.provider,
      model: route.model,
      usage: draft.usage
    });
    return sample === null ? null : { sample };
  }
};

// src/host/config.ts
import os from "node:os";
import path2 from "node:path";

// src/host/pricing.ts
var TOKENS_PER_MILLION = 1e6;
var CATALOG_UPDATED_AT = "2026-08-23T00:00:00.000Z";
var SOURCE = {
  kind: "official",
  provider: "deepseek",
  url: "https://api-docs.deepseek.com/quick_start/pricing/"
};
var TIME_BAND_V1_FROM = "2026-08-16T16:00:00.000Z";
var WEEKDAY_SCHEDULE_FROM = "2026-08-22T16:00:00.000Z";
var SHANGHAI_WINDOWS = [
  ["09:00", "12:00"],
  ["14:00", "18:00"]
];
function prices(input, cacheRead, output, cacheWrite = null) {
  return { input, cacheRead, cacheWrite, output };
}
function flatRule(input) {
  return {
    id: input.id,
    providerFamily: "deepseek",
    model: input.model,
    currency: "USD",
    ...input.effectiveTo === void 0 ? {} : { effectiveTo: input.effectiveTo },
    pricing: { flat: input.unit },
    schedule: null,
    source: { ...SOURCE },
    updatedAt: CATALOG_UPDATED_AT
  };
}
function timeBandRule(input) {
  return {
    id: input.id,
    providerFamily: "deepseek",
    model: input.model,
    currency: "USD",
    effectiveFrom: input.effectiveFrom,
    ...input.effectiveTo === void 0 ? {} : { effectiveTo: input.effectiveTo },
    pricing: { offPeak: input.offPeak, peak: input.peak },
    schedule: {
      timezone: "Asia/Shanghai",
      peakDays: input.peakDays,
      peakWindows: SHANGHAI_WINDOWS,
      otherwise: "offPeak"
    },
    source: { ...SOURCE },
    updatedAt: CATALOG_UPDATED_AT
  };
}
var DEEPSEEK_PRICING_RULES = [
  flatRule({
    id: "deepseek-v4-flash-usd-flat-before-2026-08-16",
    model: "deepseek-v4-flash",
    effectiveTo: TIME_BAND_V1_FROM,
    unit: prices(0.14, 28e-4, 0.28)
  }),
  flatRule({
    id: "deepseek-v4-pro-usd-flat-before-2026-08-16",
    model: "deepseek-v4-pro",
    effectiveTo: TIME_BAND_V1_FROM,
    unit: prices(0.435, 3625e-6, 0.87)
  }),
  timeBandRule({
    id: "deepseek-v4-flash-usd-time-band-v1",
    model: "deepseek-v4-flash",
    effectiveFrom: TIME_BAND_V1_FROM,
    effectiveTo: WEEKDAY_SCHEDULE_FROM,
    peakDays: [0, 1, 2, 3, 4, 5, 6],
    offPeak: prices(0.22, 7e-3, 0.66),
    peak: prices(0.44, 0.014, 1.32)
  }),
  timeBandRule({
    id: "deepseek-v4-pro-usd-time-band-v1",
    model: "deepseek-v4-pro",
    effectiveFrom: TIME_BAND_V1_FROM,
    effectiveTo: WEEKDAY_SCHEDULE_FROM,
    peakDays: [0, 1, 2, 3, 4, 5, 6],
    offPeak: prices(0.66, 0.022, 1.98),
    peak: prices(1.32, 0.044, 3.96)
  }),
  timeBandRule({
    id: "deepseek-v4-flash-usd-weekday-schedule",
    model: "deepseek-v4-flash",
    effectiveFrom: WEEKDAY_SCHEDULE_FROM,
    peakDays: [1, 2, 3, 4, 5],
    offPeak: prices(0.22, 7e-3, 0.66),
    peak: prices(0.44, 0.014, 1.32)
  }),
  timeBandRule({
    id: "deepseek-v4-pro-usd-weekday-schedule",
    model: "deepseek-v4-pro",
    effectiveFrom: WEEKDAY_SCHEDULE_FROM,
    peakDays: [1, 2, 3, 4, 5],
    offPeak: prices(0.66, 0.022, 1.98),
    peak: prices(1.32, 0.044, 3.96)
  })
];
var DEFAULT_MODEL_ALIASES = {
  "deepseek-flash": "deepseek-v4-flash",
  "deepseek-pro": "deepseek-v4-pro"
};
var DEFAULT_PRICED_PROVIDERS = [
  "deepseek",
  "deepseek-official",
  "deepseek-account"
];
function timestampOf(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const normalized = value.trim();
    if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized)) return null;
    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
function boundaryOf(value, fallback) {
  if (value === void 0) return fallback;
  const timestamp = timestampOf(value);
  if (timestamp === null) throw new Error(`invalid pricing boundary: ${value}`);
  return timestamp;
}
function minuteOf(clock) {
  const match = /^(\d{2}):(\d{2})$/.exec(clock);
  if (match === null) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}
function isEffective(rule, at) {
  if (at < boundaryOf(rule.effectiveFrom, -Infinity)) return false;
  if (at >= boundaryOf(rule.effectiveTo, Infinity)) return false;
  return true;
}
function validateRules(rules) {
  if (!Array.isArray(rules)) throw new Error("pricing rules must be an array");
  const ids = /* @__PURE__ */ new Set();
  for (const [index, rule] of rules.entries()) {
    const label = `pricing.rules[${index}]`;
    if (rule === null || typeof rule !== "object") throw new Error(`${label} must be an object`);
    if (typeof rule.id !== "string" || rule.id === "" || ids.has(rule.id)) throw new Error(`${label}.id must be unique`);
    ids.add(rule.id);
    if (typeof rule.model !== "string" || rule.model === "") throw new Error(`${label}.model is required`);
    if (typeof rule.currency !== "string" || !/^[A-Z]{3}$/.test(rule.currency)) throw new Error(`${label}.currency is invalid`);
    if (rule.schedule === null) {
      if (!("flat" in rule.pricing)) throw new Error(`${label}.pricing must be flat without a schedule`);
    } else if (!("peak" in rule.pricing) || !("offPeak" in rule.pricing)) {
      throw new Error(`${label}.pricing must carry peak and offPeak with a schedule`);
    }
    boundaryOf(rule.effectiveFrom, -Infinity);
    boundaryOf(rule.effectiveTo, Infinity);
  }
}
function zonedClock(timestamp, timezone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const parts = formatter.formatToParts(new Date(timestamp));
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    weekday: weekdays[get("weekday")] ?? -1,
    minute: Number(get("hour")) * 60 + Number(get("minute"))
  };
}
function unitPricesAt(rule, at) {
  if (rule.schedule === null) {
    return "flat" in rule.pricing ? rule.pricing.flat : null;
  }
  const clock = zonedClock(at, rule.schedule.timezone);
  const inPeakDay = rule.schedule.peakDays.includes(clock.weekday);
  const inPeakWindow = rule.schedule.peakWindows.some(([start, end]) => {
    const from = minuteOf(start);
    const to = minuteOf(end);
    return from !== null && to !== null && clock.minute >= from && clock.minute < to;
  });
  if ("peak" in rule.pricing && "offPeak" in rule.pricing) {
    return inPeakDay && inPeakWindow ? rule.pricing.peak : rule.pricing.offPeak;
  }
  return null;
}
function priceBuckets(unit, buckets) {
  const components = [
    [buckets.input, unit.input],
    [buckets.cacheRead, unit.cacheRead],
    [buckets.cacheWrite, unit.cacheWrite],
    [buckets.output, unit.output]
  ];
  let total = 0;
  for (const [tokens, price] of components) {
    if (tokens === 0) continue;
    if (price === null) return null;
    total += tokens / TOKENS_PER_MILLION * price;
  }
  return total;
}
function createPricer(options = {}, warn2 = () => {
}) {
  const userRules = options.rules ?? [];
  if (userRules.length > 0) {
    try {
      validateRules(userRules);
    } catch (error) {
      warn2(`ignoring invalid pricing.rules: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const validUserRules = userRules.length > 0 ? userRules : [];
  const userIds = new Set(validUserRules.map((rule) => rule.id));
  const rules = [...DEEPSEEK_PRICING_RULES.filter((rule) => !userIds.has(rule.id)), ...validUserRules];
  const aliases = { ...DEFAULT_MODEL_ALIASES, ...options.aliases ?? {} };
  const providers = new Set(options.providers ?? DEFAULT_PRICED_PROVIDERS);
  function estimate(sample) {
    const buckets = sample.buckets;
    if (buckets.input + buckets.output + buckets.cacheRead + buckets.cacheWrite <= 0) return { counted: false };
    if (!providers.has(sample.provider)) return { counted: true, complete: false };
    const model = aliases[sample.model] ?? sample.model;
    const at = sample.time;
    const candidates = rules.filter((rule2) => rule2.model === model && isEffective(rule2, at));
    if (candidates.length === 0) return { counted: true, complete: false };
    if (candidates.length > 1) {
      return { counted: true, complete: false };
    }
    const rule = candidates[0];
    const unit = unitPricesAt(rule, at);
    if (unit === null) return { counted: true, complete: false };
    const amount = priceBuckets(unit, buckets);
    if (amount === null) return { counted: true, complete: false };
    return { counted: true, complete: true, amount, currency: rule.currency, ruleId: rule.id };
  }
  return {
    estimate,
    rules,
    catalogUpdatedAt: CATALOG_UPDATED_AT
  };
}

// src/host/config.ts
var DEFAULT_REFRESH_MS = 15e3;
var DEFAULT_SESSION_LIMIT = 12;
var DEFAULT_RECENT_LIMIT = 200;
function dataDirectory(env = process.env, home = os.homedir()) {
  const configured = typeof env.DSH_HOME === "string" ? env.DSH_HOME.trim() : "";
  const root = configured.length > 0 ? configured : path2.join(home, ".dsh");
  return path2.join(root, "token-usage-statistic");
}
function defaultDataFile(env = process.env, home = os.homedir()) {
  return path2.join(dataDirectory(env, home), "usage.jsonl");
}
function stringRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof key === "string" && key.length > 0 && typeof entry === "string" && entry.length > 0) result[key] = entry;
  }
  return result;
}
function resolveConfig(input) {
  const config = input !== null && typeof input === "object" ? input : {};
  const dataFile = typeof config.dataFile === "string" && config.dataFile.trim().length > 0 ? config.dataFile.trim() : "";
  const refresh = Number(config.refreshMs);
  const sessions = Number(config.sessionLimit);
  const recent = Number(config.recentLimit);
  const pricing = config.pricing !== null && typeof config.pricing === "object" ? config.pricing : {};
  const rules = Array.isArray(pricing.rules) ? pricing.rules : [];
  const providers = Array.isArray(pricing.providers) ? pricing.providers.filter((entry) => typeof entry === "string" && entry.length > 0) : [];
  const accountsRaw = config.accounts !== null && typeof config.accounts === "object" ? config.accounts : {};
  const accountRefresh = Number(accountsRaw.refreshMs);
  const accountTimeout = Number(accountsRaw.timeoutMs);
  return {
    dataFile,
    refreshMs: Number.isFinite(refresh) && refresh >= 3e3 ? Math.floor(refresh) : DEFAULT_REFRESH_MS,
    sessionLimit: Number.isFinite(sessions) && sessions > 0 ? Math.min(Math.floor(sessions), 100) : DEFAULT_SESSION_LIMIT,
    recentLimit: Number.isFinite(recent) && recent >= 0 ? Math.min(Math.floor(recent), 5e3) : DEFAULT_RECENT_LIMIT,
    backfill: config.backfill === void 0 ? true : config.backfill !== false,
    modelAliases: { ...DEFAULT_MODEL_ALIASES, ...stringRecord(config.modelAliases) },
    pricingRules: rules,
    pricedProviders: providers.length > 0 ? providers : [...DEFAULT_PRICED_PROVIDERS],
    accounts: {
      refreshMs: Number.isFinite(accountRefresh) && accountRefresh >= 6e4 ? Math.min(Math.floor(accountRefresh), 864e5) : 6e5,
      timeoutMs: Number.isFinite(accountTimeout) && accountTimeout >= 1e3 ? Math.min(Math.floor(accountTimeout), 6e4) : 15e3,
      monitors: readMonitors(accountsRaw.monitors)
    },
    budgets: resolveBudgetConfig(config.budgets)
  };
}

// src/host/ledger.ts
import { appendFile, mkdir as mkdir2, readFile as readFile2, stat } from "node:fs/promises";
import path3 from "node:path";
async function loadLedger(file) {
  let text;
  try {
    text = await readFile2(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { records: [], bytes: 0, lines: 0, skipped: 0 };
    }
    throw error;
  }
  const records = [];
  let lines = 0;
  let skipped = 0;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    lines += 1;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) records.push(parsed);
      else skipped += 1;
    } catch {
      skipped += 1;
    }
  }
  return { records, bytes: Buffer.byteLength(text), lines, skipped };
}
var LedgerWriter = class {
  file;
  queue = Promise.resolve(true);
  onError;
  bytes = 0;
  writes = 0;
  error;
  constructor(file, options = {}) {
    this.file = file;
    this.onError = options.onError;
  }
  /** Queue one sample. */
  append(record) {
    let line;
    try {
      line = `${JSON.stringify(record)}
`;
    } catch (error) {
      this.error = error;
      this.onError?.(error);
      return Promise.resolve(false);
    }
    const next = this.queue.then(async () => {
      await mkdir2(path3.dirname(this.file), { recursive: true });
      await appendFile(this.file, line, "utf8");
      this.bytes += Buffer.byteLength(line);
      this.writes += 1;
      return true;
    });
    this.queue = next.catch((error) => {
      this.error = error;
      this.onError?.(error);
      return false;
    });
    return this.queue;
  }
  /** Wait for every queued append; returns whether all succeeded. */
  async flush() {
    await this.queue;
    return this.error === void 0;
  }
};

// src/host/sessionNames.ts
var SessionNameService = class _SessionNameService {
  static TTL_MS = 3e4;
  workspaceRegistry;
  sessionQuery;
  log;
  workspaceBySession = /* @__PURE__ */ new Map();
  nameBySession = /* @__PURE__ */ new Map();
  lastRefreshAt = 0;
  refreshing = null;
  constructor(config = {}) {
    this.workspaceRegistry = config.workspaceRegistry;
    this.sessionQuery = config.sessionQuery;
    this.log = config.log ?? (() => {
    });
  }
  /** Late-binding helper: services may become available after activation. */
  setSources(config) {
    this.workspaceRegistry = config.workspaceRegistry;
    this.sessionQuery = config.sessionQuery;
  }
  /** Refresh workspace and title information for a set of session ids. */
  async refresh(sessionIds) {
    this.refreshWorkspaces();
    if (sessionIds.length === 0) return;
    if (Date.now() - this.lastRefreshAt < _SessionNameService.TTL_MS) return;
    if (this.refreshing !== null) return this.refreshing;
    this.refreshing = this.refreshTitles(sessionIds).finally(() => {
      this.lastRefreshAt = Date.now();
      this.refreshing = null;
    });
    return this.refreshing;
  }
  refreshWorkspaces() {
    if (this.workspaceRegistry === void 0) return;
    try {
      const next = /* @__PURE__ */ new Map();
      for (const workspace of this.workspaceRegistry.list()) {
        for (const sessionId of workspace.sessionIds) next.set(sessionId, workspace.title);
      }
      this.workspaceBySession = next;
    } catch (error) {
      this.log(`workspace list failed: ${describeError(error)}`);
    }
  }
  async refreshTitles(sessionIds) {
    if (this.sessionQuery === void 0) return;
    try {
      const results = await this.sessionQuery.readTitleSnapshots(sessionIds);
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const title = result.value?.title?.title;
        if (typeof title === "string" && title.length > 0) {
          this.nameBySession.set(result.sessionId, title);
        }
      }
    } catch (error) {
      this.log(`session title query failed: ${describeError(error)}`);
    }
  }
  get(sessionId) {
    return {
      name: this.nameBySession.get(sessionId),
      workspace: this.workspaceBySession.get(sessionId)
    };
  }
};
function describeError(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/host/store.ts
function modelKeyOf(provider, model) {
  return `${provider}/${model}`;
}
function splitModelKey(key) {
  const slash = key.indexOf("/");
  if (slash <= 0 || slash === key.length - 1) return { provider: "unknown", model: key };
  return { provider: key.slice(0, slash), model: key.slice(slash + 1) };
}
function shiftBuckets(target, source, sign) {
  target.input += sign * source.input;
  target.output += sign * source.output;
  target.cacheRead += sign * source.cacheRead;
  target.cacheWrite += sign * source.cacheWrite;
}
function resolveRange(days, now) {
  if (days === null) return null;
  const requested = Math.floor(Number(days));
  if (!Number.isFinite(requested) || requested <= 0) return null;
  const window = Math.min(requested, 3650);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (window - 1));
  return { days: window, from: dayKey(start.getTime()), to: dayKey(now) };
}
var DEFAULT_BUDGETS = {
  currency: "USD",
  daily: { limit: null, currency: "USD", spend: 0, percent: null, costComplete: true, level: null },
  monthly: { limit: null, currency: "USD", spend: 0, percent: null, costComplete: true, level: null }
};
function totalsOf(buckets, calls) {
  return {
    calls,
    input: buckets.input,
    output: buckets.output,
    cacheRead: buckets.cacheRead,
    cacheWrite: buckets.cacheWrite,
    tokens: totalTokens(buckets),
    cacheHitRate: cacheHitRate(buckets)
  };
}
var UsageStore = class {
  pricer;
  recentLimit;
  samples = /* @__PURE__ */ new Map();
  days = /* @__PURE__ */ new Map();
  sessions = /* @__PURE__ */ new Map();
  maxSeq = /* @__PURE__ */ new Map();
  recent = [];
  updatedAt = 0;
  skipped = 0;
  replaced = 0;
  constructor(options) {
    this.pricer = options.pricer;
    this.recentLimit = Number.isFinite(options.recentLimit) && (options.recentLimit ?? 0) >= 0 ? Math.floor(options.recentLimit ?? 200) : 200;
  }
  /** Fold one untrusted ledger line or collector sample. */
  apply(raw) {
    const sample = sanitizeSample(raw);
    if (sample === null) {
      this.skipped += 1;
      return false;
    }
    const key = `${sample.sessionId}#${sample.sampleKey}`;
    const previous = this.samples.get(key);
    if (previous !== void 0 && sample.seq < previous.seq) return false;
    if (previous !== void 0 && this.isSameReport(previous, sample)) return false;
    const cost = this.pricer.estimate(sample);
    if (previous !== void 0) {
      this.mutate(previous, -1);
      this.replaced += 1;
      this.removeRecent(key);
    }
    const stored = { ...sample, cost };
    this.samples.set(key, stored);
    this.mutate(stored, 1);
    this.pushRecent(stored);
    const previousSeq = this.maxSeq.get(sample.sessionId) ?? -1;
    if (sample.seq > previousSeq) this.maxSeq.set(sample.sessionId, sample.seq);
    if (sample.time > this.updatedAt) this.updatedAt = sample.time;
    return true;
  }
  /** Fold many lines; returns how many were accepted. */
  applyAll(raws) {
    let accepted = 0;
    for (const raw of raws) if (this.apply(raw)) accepted += 1;
    return accepted;
  }
  /** Highest accepted seq per session, for incremental historical scans. */
  lastSeqBySession() {
    return new Map(this.maxSeq);
  }
  /** Highest accepted seq for one session (-1 when nothing was seen). */
  lastSeq(sessionId) {
    return this.maxSeq.get(sessionId) ?? -1;
  }
  /** Every session id currently known to the fold. */
  sessionIds() {
    return [...this.sessions.keys()];
  }
  /** How many lines were rejected and how many were replaced. */
  diagnostics() {
    return { skipped: this.skipped, replaced: this.replaced };
  }
  isSameReport(left, right) {
    return left.seq === right.seq && left.time === right.time && left.buckets.input === right.buckets.input && left.buckets.output === right.buckets.output && left.buckets.cacheRead === right.buckets.cacheRead && left.buckets.cacheWrite === right.buckets.cacheWrite;
  }
  /** Add (`1`) or subtract (`-1`) one sample from every fold it touches. */
  mutate(sample, sign) {
    const day = this.ensureDay(sample.day);
    shiftBuckets(day.buckets, sample.buckets, sign);
    day.calls += sign;
    applyCostSample(day.cost, sample.cost, sign);
    const model = this.ensureModel(day, sample);
    shiftBuckets(model.buckets, sample.buckets, sign);
    model.calls += sign;
    applyCostSample(model.cost, sample.cost, sign);
    let sessionDay = day.sessions.get(sample.sessionId);
    if (sessionDay === void 0) {
      sessionDay = { buckets: emptyBuckets(), cost: createCostAccumulator(), calls: 0, lastAt: sample.time };
      day.sessions.set(sample.sessionId, sessionDay);
    }
    shiftBuckets(sessionDay.buckets, sample.buckets, sign);
    sessionDay.calls += sign;
    sessionDay.lastAt = Math.max(sessionDay.lastAt, sample.time);
    applyCostSample(sessionDay.cost, sample.cost, sign);
    let session = this.sessions.get(sample.sessionId);
    if (session === void 0) {
      session = {
        buckets: emptyBuckets(),
        cost: createCostAccumulator(),
        calls: 0,
        firstAt: sample.time,
        lastAt: sample.time,
        models: /* @__PURE__ */ new Map()
      };
      this.sessions.set(sample.sessionId, session);
    }
    shiftBuckets(session.buckets, sample.buckets, sign);
    session.calls += sign;
    applyCostSample(session.cost, sample.cost, sign);
    session.firstAt = Math.min(session.firstAt, sample.time);
    session.lastAt = Math.max(session.lastAt, sample.time);
    const key = modelKeyOf(sample.provider, sample.model);
    const count2 = (session.models.get(key) ?? 0) + sign;
    if (count2 <= 0) session.models.delete(key);
    else session.models.set(key, count2);
    this.prune(day, sample, sign);
  }
  prune(day, sample, sign) {
    if (sign > 0) return;
    const model = day.models.get(modelKeyOf(sample.provider, sample.model));
    if (model !== void 0 && model.calls <= 0) day.models.delete(modelKeyOf(sample.provider, sample.model));
    const sessionDay = day.sessions.get(sample.sessionId);
    if (sessionDay !== void 0 && sessionDay.calls <= 0) day.sessions.delete(sample.sessionId);
    const session = this.sessions.get(sample.sessionId);
    if (session !== void 0 && session.calls <= 0) this.sessions.delete(sample.sessionId);
    if (day.calls <= 0 && day.models.size === 0) this.days.delete(day.day);
  }
  ensureDay(day) {
    let entry = this.days.get(day);
    if (entry === void 0) {
      entry = {
        day,
        buckets: emptyBuckets(),
        cost: createCostAccumulator(),
        calls: 0,
        models: /* @__PURE__ */ new Map(),
        sessions: /* @__PURE__ */ new Map()
      };
      this.days.set(day, entry);
    }
    return entry;
  }
  ensureModel(day, sample) {
    const key = modelKeyOf(sample.provider, sample.model);
    let entry = day.models.get(key);
    if (entry === void 0) {
      entry = { buckets: emptyBuckets(), cost: createCostAccumulator(), calls: 0 };
      day.models.set(key, entry);
    }
    return entry;
  }
  pushRecent(sample) {
    if (this.recentLimit <= 0) return;
    this.recent.push(sample);
    const overflow = this.recent.length - this.recentLimit;
    if (overflow > 0) this.recent.splice(0, overflow);
  }
  removeRecent(key) {
    const index = this.recent.findIndex((sample) => `${sample.sessionId}#${sample.sampleKey}` === key);
    if (index >= 0) this.recent.splice(index, 1);
  }
  /** Merge the cost accumulators of every day inside the inclusive range. */
  costBetween(from, to) {
    const accumulator = createCostAccumulator();
    for (const [day, entry] of this.days) {
      if (day < from || day > to) continue;
      mergeCost(accumulator, entry.cost);
    }
    return accumulator;
  }
  /** Flatten every day/model fold into export rows. */
  dailyRows() {
    const rows = [];
    for (const [day, entry] of this.days) {
      for (const [key, model] of entry.models) {
        const { provider, model: modelId } = splitModelKey(key);
        rows.push({
          day,
          provider,
          model: modelId,
          ...totalsOf(model.buckets, model.calls),
          cost: renderCost(model.cost)
        });
      }
    }
    rows.sort(
      (left, right) => (left.day < right.day ? 1 : left.day > right.day ? -1 : 0) || left.provider.localeCompare(right.provider) || left.model.localeCompare(right.model)
    );
    return rows;
  }
  /** Flatten every all-time session fold into export rows. */
  sessionRows() {
    const rows = [];
    for (const [sessionId, session] of this.sessions) {
      const models = [...session.models.keys()];
      const providers = [...new Set(models.map((key) => splitModelKey(key).provider))].sort();
      rows.push({
        sessionId,
        providers,
        models: models.sort(),
        ...totalsOf(session.buckets, session.calls),
        cost: renderCost(session.cost),
        firstAt: session.firstAt,
        lastAt: session.lastAt
      });
    }
    rows.sort((left, right) => right.tokens - left.tokens || right.calls - left.calls);
    return rows;
  }
  /** Per-day detail view for the chart and drill-down tables. */
  dailyDetails(options = {}) {
    const now = options.now ?? Date.now();
    const requestedDays = options.days === void 0 ? 30 : options.days;
    const range = resolveRange(requestedDays, now);
    const sessionLimit = Math.max(0, Math.floor(options.sessionLimit ?? 12));
    const days = [];
    for (const [day, entry] of this.days) {
      if (range !== null && day < range.from) continue;
      const models = [];
      for (const [key, model] of entry.models) {
        const { provider, model: modelId } = splitModelKey(key);
        models.push({
          key,
          provider,
          model: modelId,
          ...totalsOf(model.buckets, model.calls),
          cost: renderCost(model.cost)
        });
      }
      models.sort((left, right) => right.tokens - left.tokens || left.model.localeCompare(right.model));
      const sessions = [];
      for (const [sessionId, session] of entry.sessions) {
        const record = this.sessions.get(sessionId);
        const names = options.sessionNames?.get(sessionId);
        sessions.push({
          sessionId,
          name: names?.name ?? null,
          workspace: names?.workspace ?? null,
          ...totalsOf(session.buckets, session.calls),
          firstAt: record?.firstAt ?? session.lastAt,
          lastAt: record?.lastAt ?? session.lastAt,
          cost: renderCost(session.cost),
          models: record === void 0 ? [] : [...record.models.keys()].sort()
        });
      }
      sessions.sort((left, right) => right.tokens - left.tokens || right.calls - left.calls);
      const limitedSessions = sessions.slice(0, sessionLimit);
      days.push({
        day,
        ...totalsOf(entry.buckets, entry.calls),
        cost: renderCost(entry.cost),
        sessions: limitedSessions,
        models
      });
    }
    days.sort((left, right) => left.day < right.day ? 1 : left.day > right.day ? -1 : 0);
    return {
      schemaVersion: 2,
      generatedAt: now,
      range: range === null ? { days: null, from: null, to: null } : range,
      days
    };
  }
  /** The pricing catalog's own version string. */
  pricingCatalogUpdatedAt() {
    return this.pricer.catalogUpdatedAt;
  }
  /** Build the JSON payload the panel consumes. */
  snapshot(options = {}) {
    const now = options.now ?? Date.now();
    const requestedDays = options.days === void 0 ? 30 : options.days;
    const range = resolveRange(requestedDays, now);
    const sessionLimit = Math.max(0, Math.floor(options.sessionLimit ?? 12));
    const recentLimit = Math.max(0, Math.floor(options.recentLimit ?? 20));
    const buckets = emptyBuckets();
    let calls = 0;
    const totalCost = createCostAccumulator();
    const models = /* @__PURE__ */ new Map();
    const sessions = /* @__PURE__ */ new Map();
    const byDay = [];
    for (const [day, entry] of this.days) {
      if (range !== null && day < range.from) continue;
      shiftBuckets(buckets, entry.buckets, 1);
      calls += entry.calls;
      mergeCost(totalCost, entry.cost);
      byDay.push({
        day,
        ...totalsOf(entry.buckets, entry.calls),
        cost: renderCost(entry.cost)
      });
      for (const [key, model] of entry.models) {
        let target = models.get(key);
        if (target === void 0) {
          target = { buckets: emptyBuckets(), cost: createCostAccumulator(), calls: 0 };
          models.set(key, target);
        }
        shiftBuckets(target.buckets, model.buckets, 1);
        target.calls += model.calls;
        mergeCost(target.cost, model.cost);
      }
      for (const [sessionId, session] of entry.sessions) {
        let target = sessions.get(sessionId);
        if (target === void 0) {
          target = { buckets: emptyBuckets(), cost: createCostAccumulator(), calls: 0, lastAt: session.lastAt };
          sessions.set(sessionId, target);
        }
        shiftBuckets(target.buckets, session.buckets, 1);
        target.calls += session.calls;
        target.lastAt = Math.max(target.lastAt, session.lastAt);
        mergeCost(target.cost, session.cost);
      }
    }
    byDay.sort((left, right) => left.day < right.day ? 1 : left.day > right.day ? -1 : 0);
    const modelViews = [];
    for (const [key, model] of models) {
      const { provider, model: modelId } = splitModelKey(key);
      modelViews.push({
        key,
        provider,
        model: modelId,
        ...totalsOf(model.buckets, model.calls),
        cost: renderCost(model.cost)
      });
    }
    modelViews.sort((left, right) => right.tokens - left.tokens || right.calls - left.calls || left.key.localeCompare(right.key));
    const grouped = /* @__PURE__ */ new Map();
    for (const [key, model] of models) {
      const { provider, model: modelId } = splitModelKey(key);
      let entry = grouped.get(provider);
      if (entry === void 0) {
        entry = { buckets: emptyBuckets(), cost: createCostAccumulator(), calls: 0, models: [] };
        grouped.set(provider, entry);
      }
      shiftBuckets(entry.buckets, model.buckets, 1);
      entry.calls += model.calls;
      mergeCost(entry.cost, model.cost);
      entry.models.push({
        key,
        provider,
        model: modelId,
        ...totalsOf(model.buckets, model.calls),
        cost: renderCost(model.cost)
      });
    }
    const byProvider = [...grouped.entries()].map(([provider, entry]) => ({
      provider,
      ...totalsOf(entry.buckets, entry.calls),
      cost: renderCost(entry.cost),
      models: entry.models.sort((left, right) => right.tokens - left.tokens || left.model.localeCompare(right.model))
    })).sort((left, right) => right.tokens - left.tokens || left.provider.localeCompare(right.provider));
    const sessionViews = [];
    for (const [sessionId, session] of sessions) {
      const record = this.sessions.get(sessionId);
      const names = options.sessionNames?.get(sessionId);
      sessionViews.push({
        sessionId,
        name: names?.name ?? null,
        workspace: names?.workspace ?? null,
        calls: session.calls,
        input: session.buckets.input,
        output: session.buckets.output,
        cacheRead: session.buckets.cacheRead,
        cacheWrite: session.buckets.cacheWrite,
        tokens: totalTokens(session.buckets),
        cacheHitRate: cacheHitRate(session.buckets),
        firstAt: record?.firstAt ?? session.lastAt,
        lastAt: record?.lastAt ?? session.lastAt,
        cost: renderCost(session.cost),
        models: record === void 0 ? [] : [...record.models.keys()].sort()
      });
    }
    sessionViews.sort((left, right) => right.tokens - left.tokens || right.calls - left.calls);
    const limitedSessions = sessionViews.slice(0, sessionLimit);
    const recent = this.recent.filter((sample) => range === null || sample.day >= range.from).sort((left, right) => right.time - left.time).slice(0, recentLimit).map((sample) => ({
      time: sample.time,
      sessionId: sample.sessionId,
      provider: sample.provider,
      model: sample.model,
      calls: 1,
      input: sample.buckets.input,
      output: sample.buckets.output,
      cacheRead: sample.buckets.cacheRead,
      cacheWrite: sample.buckets.cacheWrite,
      tokens: totalTokens(sample.buckets),
      cacheHitRate: cacheHitRate(sample.buckets),
      cost: renderSampleCost(sample.cost)
    }));
    const totalCostRender = renderCost(totalCost);
    return {
      schemaVersion: 2,
      generatedAt: now,
      updatedAt: this.updatedAt,
      range: range === null ? { days: null, from: null, to: null } : range,
      totals: { ...totalsOf(buckets, calls), cost: totalCostRender },
      byProvider,
      byDay,
      sessions: limitedSessions,
      recent,
      counts: {
        samples: this.samples.size,
        sessions: this.sessions.size,
        days: this.days.size,
        models: modelViews.length,
        unpriced: totalCostRender.unpricedCalls
      },
      pricing: {
        ruleIds: totalCostRender.ruleIds,
        currency: totalCostRender.currency,
        catalogUpdatedAt: this.pricer.catalogUpdatedAt
      },
      budgets: options.budgets ?? DEFAULT_BUDGETS,
      backfill: options.backfill ?? {
        state: "idle",
        sessions: 0,
        events: 0,
        skipped: 0,
        inherited: 0,
        startedAt: null,
        finishedAt: null,
        error: null
      },
      config: { refreshMs: options.refreshMs ?? 15e3 }
    };
  }
};

// src/host/index.ts
var PACKAGE = "token-usage-statistic";
function warn(...values) {
  try {
    console.warn(`[${PACKAGE}]`, ...values);
  } catch {
  }
}
function describeError2(error) {
  return error instanceof Error ? error.message : String(error);
}
function createActivationRecorder(dataFile) {
  const file = path4.join(path4.dirname(dataFile), "activation.json");
  return async (patch) => {
    try {
      await mkdir3(path4.dirname(file), { recursive: true });
      await writeFile2(file, `${JSON.stringify({ at: Date.now(), dataFile, ...patch }, null, 2)}
`, "utf8");
    } catch (error) {
      warn("activation receipt could not be written:", describeError2(error));
    }
  };
}
async function apply(ctx, config) {
  const settings = resolveConfig(config);
  const dataFile = settings.dataFile || defaultDataFile();
  const recordActivation = createActivationRecorder(dataFile);
  const pricer = createPricer(
    {
      rules: settings.pricingRules,
      aliases: settings.modelAliases,
      providers: settings.pricedProviders
    },
    (message) => warn(message)
  );
  const store = new UsageStore({ pricer, recentLimit: settings.recentLimit });
  const ledger = new LedgerWriter(dataFile, { onError: (error) => warn("ledger append failed:", describeError2(error)) });
  const collector = new Collector();
  const sessionNames = new SessionNameService({ log: (message) => warn(message) });
  let backfill;
  let registry;
  try {
    const loaded = await loadLedger(dataFile);
    store.applyAll(loaded.records);
    const diagnostics = store.diagnostics();
    if (loaded.skipped > 0) warn(`ignored ${loaded.skipped} unreadable ledger line(s) in ${dataFile}`);
    if (diagnostics.skipped > 0) warn(`ignored ${diagnostics.skipped} invalid ledger record(s)`);
  } catch (error) {
    warn("ledger could not be read, starting from an empty fold:", describeError2(error));
  }
  const ingest = (session, event) => {
    const collected = collector.observe(session, event);
    if (collected === null) return;
    if (!store.apply(collected.sample)) return;
    void ledger.append(collected.sample);
  };
  ctx.effect(() => ctx.on("session/event", (session, event) => ingest(session, event)));
  ctx.effect(() => ctx.on("session/disposed", (session) => collector.forget(session?.id)));
  ctx.effect(() => () => {
    void ledger.flush();
  });
  ctx.inject(["webServer"], (scope) => {
    const server = scope.get("webServer");
    if (server === void 0 || typeof server.register !== "function") {
      warn("webServer is unavailable; the panel will report HTTP 404");
      return;
    }
    const handler = createHttpHandler({
      store,
      backfill: () => backfill?.getStatus() ?? IDLE_BACKFILL,
      accounts: () => registry?.snapshot() ?? emptyAccountsPayload(settings.accounts.refreshMs),
      budgets: (now) => budgetState(store, settings.budgets, now),
      refreshAccounts: () => {
        void registry?.refresh();
      },
      refreshMs: settings.refreshMs,
      sessionNames
    });
    try {
      for (const route of Object.values(ROUTES)) {
        scope.effect(() => server.register({ kind: "exact", path: route, handler }));
      }
      let origin;
      try {
        origin = server.getOrigin?.();
      } catch {
        origin = void 0;
      }
      void recordActivation({ route: "registered", origin, paths: Object.values(ROUTES) });
    } catch (error) {
      warn("web route registration failed:", describeError2(error));
      void recordActivation({ route: "failed", error: describeError2(error) });
    }
  });
  ctx.inject(["workspaceRegistry", "sessionQuery"], (scope) => {
    try {
      sessionNames.setSources({
        workspaceRegistry: scope.get("workspaceRegistry"),
        sessionQuery: scope.get("sessionQuery")
      });
      void sessionNames.refresh(store.sessionIds());
    } catch (error) {
      warn("workspace/session-name services unavailable:", describeError2(error));
    }
  });
  ctx.inject(["settings", "credentials"], (scope) => {
    registry = new AccountRegistry({
      services: scope,
      dataDir: path4.dirname(dataFile),
      config: settings.accounts,
      version: "0.3.0",
      log: (message) => warn(message)
    });
    if (typeof registry.loadCache === "function") {
      void registry.loadCache();
    }
    scope.effect(() => registry?.start() ?? (() => {
    }));
  });
  if (settings.backfill) {
    ctx.inject(["sessionPersistence"], (scope) => {
      const persistence = scope.get("sessionPersistence");
      if (persistence === void 0) {
        warn("sessionPersistence is unavailable; only live usage will be recorded");
        return;
      }
      backfill = new Backfill({
        persistence,
        lastSeqOf: (sessionId) => store.lastSeq(sessionId),
        onEvent: (sessionId, event) => ingest({ id: sessionId }, event),
        log: warn
      });
      scope.effect(() => {
        const timer = setTimeout(() => {
          void backfill?.run();
        }, 1500);
        return () => clearTimeout(timer);
      });
    });
  }
}
export {
  PACKAGE,
  apply
};
