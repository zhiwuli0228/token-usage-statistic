// src/host/index.ts
import { mkdir as mkdir2, writeFile } from "node:fs/promises";
import path3 from "node:path";

// src/host/api.ts
var API_PREFIX = "/token-usage-statistic/";
var SUMMARY_PATH = `${API_PREFIX}api/summary`;
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
function sendJson(response, status, body, options = {}) {
  if (typeof response.writeHead !== "function" || typeof response.end !== "function") return;
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
    ...options.headers ?? {}
  });
  if (options.method === "HEAD") {
    response.end();
    return;
  }
  response.end(payload);
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
  return function handle(request, response) {
    const method = typeof request.method === "string" ? request.method : "GET";
    let url;
    try {
      url = new URL(typeof request.url === "string" ? request.url : "/", "http://localhost");
    } catch {
      sendJson(response, 400, { error: "bad-request" }, { method });
      return;
    }
    if (url.pathname !== SUMMARY_PATH) {
      sendJson(response, 404, { error: "not-found", path: url.pathname }, { method });
      return;
    }
    if (method !== "GET" && method !== "HEAD") {
      sendJson(response, 405, { error: "method-not-allowed" }, { method, headers: { allow: "GET, HEAD" } });
      return;
    }
    try {
      const days = parseDays(url.searchParams.get("days"));
      const sessionLimit = parseLimit(url.searchParams.get("sessions"), 12, 100);
      const recentLimit = parseLimit(url.searchParams.get("recent"), 20, 100);
      const snapshot = dependencies.store.snapshot({
        days,
        sessionLimit,
        recentLimit,
        now: now(),
        backfill: dependencies.backfill() ?? IDLE_BACKFILL,
        refreshMs: dependencies.refreshMs
      });
      sendJson(response, 200, snapshot, { method });
    } catch (error) {
      sendJson(
        response,
        500,
        { error: "internal", message: error instanceof Error ? error.message : String(error) },
        { method }
      );
    }
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
import path from "node:path";

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
  const root = configured.length > 0 ? configured : path.join(home, ".dsh");
  return path.join(root, "token-usage-statistic");
}
function defaultDataFile(env = process.env, home = os.homedir()) {
  return path.join(dataDirectory(env, home), "usage.jsonl");
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
  return {
    dataFile,
    refreshMs: Number.isFinite(refresh) && refresh >= 3e3 ? Math.floor(refresh) : DEFAULT_REFRESH_MS,
    sessionLimit: Number.isFinite(sessions) && sessions > 0 ? Math.min(Math.floor(sessions), 100) : DEFAULT_SESSION_LIMIT,
    recentLimit: Number.isFinite(recent) && recent >= 0 ? Math.min(Math.floor(recent), 5e3) : DEFAULT_RECENT_LIMIT,
    backfill: config.backfill === void 0 ? true : config.backfill !== false,
    modelAliases: { ...DEFAULT_MODEL_ALIASES, ...stringRecord(config.modelAliases) },
    pricingRules: rules,
    pricedProviders: providers.length > 0 ? providers : [...DEFAULT_PRICED_PROVIDERS]
  };
}

// src/host/ledger.ts
import { appendFile, mkdir, readFile, stat } from "node:fs/promises";
import path2 from "node:path";
async function loadLedger(file) {
  let text;
  try {
    text = await readFile(file, "utf8");
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
      await mkdir(path2.dirname(this.file), { recursive: true });
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
      sessionViews.push({
        sessionId,
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
function describeError(error) {
  return error instanceof Error ? error.message : String(error);
}
function createActivationRecorder(dataFile) {
  const file = path3.join(path3.dirname(dataFile), "activation.json");
  return async (patch) => {
    try {
      await mkdir2(path3.dirname(file), { recursive: true });
      await writeFile(file, `${JSON.stringify({ at: Date.now(), dataFile, ...patch }, null, 2)}
`, "utf8");
    } catch (error) {
      warn("activation receipt could not be written:", describeError(error));
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
  const ledger = new LedgerWriter(dataFile, { onError: (error) => warn("ledger append failed:", describeError(error)) });
  const collector = new Collector();
  let backfill;
  try {
    const loaded = await loadLedger(dataFile);
    store.applyAll(loaded.records);
    const diagnostics = store.diagnostics();
    if (loaded.skipped > 0) warn(`ignored ${loaded.skipped} unreadable ledger line(s) in ${dataFile}`);
    if (diagnostics.skipped > 0) warn(`ignored ${diagnostics.skipped} invalid ledger record(s)`);
  } catch (error) {
    warn("ledger could not be read, starting from an empty fold:", describeError(error));
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
      refreshMs: settings.refreshMs
    });
    try {
      scope.effect(() => server.register({ kind: "exact", path: SUMMARY_PATH, handler }));
      let origin;
      try {
        origin = server.getOrigin?.();
      } catch {
        origin = void 0;
      }
      void recordActivation({ route: "registered", origin, paths: [SUMMARY_PATH] });
    } catch (error) {
      warn("web route registration failed:", describeError(error));
      void recordActivation({ route: "failed", error: describeError(error) });
    }
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
