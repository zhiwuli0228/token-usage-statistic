/**
 * Plugin configuration resolution.
 *
 * The bundle declares no schemastery schema, so every field is optional and
 * malformed values fall back to a safe default instead of failing activation.
 * Unknown keys are ignored.
 */

import os from 'node:os'
import path from 'node:path'

import { DEFAULT_MODEL_ALIASES, DEFAULT_PRICED_PROVIDERS } from './pricing.js'
import type { PricingRule } from './types.js'

/** Raw config as it arrives from the Loader row. */
export interface PluginConfig {
  dataFile?: unknown
  refreshMs?: unknown
  sessionLimit?: unknown
  recentLimit?: unknown
  backfill?: unknown
  modelAliases?: unknown
  pricing?: unknown
}

/** Normalized config used by the plugin. */
export interface ResolvedConfig {
  dataFile: string
  refreshMs: number
  sessionLimit: number
  recentLimit: number
  backfill: boolean
  modelAliases: Record<string, string>
  pricingRules: PricingRule[]
  pricedProviders: string[]
}

const DEFAULT_REFRESH_MS = 15000
const DEFAULT_SESSION_LIMIT = 12
const DEFAULT_RECENT_LIMIT = 200

/** The plugin's data directory under `$DSH_HOME` (or `~/.dsh`). */
export function dataDirectory(env: Record<string, string | undefined> = process.env, home: string = os.homedir()): string {
  const configured = typeof env.DSH_HOME === 'string' ? env.DSH_HOME.trim() : ''
  const root = configured.length > 0 ? configured : path.join(home, '.dsh')
  return path.join(root, 'token-usage-statistic')
}

/** Default ledger path. */
export function defaultDataFile(env: Record<string, string | undefined> = process.env, home: string = os.homedir()): string {
  return path.join(dataDirectory(env, home), 'usage.jsonl')
}

function stringRecord(value: unknown): Record<string, string> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof key === 'string' && key.length > 0 && typeof entry === 'string' && entry.length > 0) result[key] = entry
  }
  return result
}

/** Resolve a raw row config into the values the plugin uses. */
export function resolveConfig(input: unknown): ResolvedConfig {
  const config = input !== null && typeof input === 'object' ? (input as PluginConfig) : {}

  const dataFile = typeof config.dataFile === 'string' && config.dataFile.trim().length > 0 ? config.dataFile.trim() : ''
  const refresh = Number(config.refreshMs)
  const sessions = Number(config.sessionLimit)
  const recent = Number(config.recentLimit)

  const pricing = config.pricing !== null && typeof config.pricing === 'object' ? (config.pricing as Record<string, unknown>) : {}
  const rules = Array.isArray(pricing.rules) ? (pricing.rules as PricingRule[]) : []
  const providers = Array.isArray(pricing.providers)
    ? pricing.providers.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    : []

  return {
    dataFile,
    refreshMs: Number.isFinite(refresh) && refresh >= 3000 ? Math.floor(refresh) : DEFAULT_REFRESH_MS,
    sessionLimit: Number.isFinite(sessions) && sessions > 0 ? Math.min(Math.floor(sessions), 100) : DEFAULT_SESSION_LIMIT,
    recentLimit: Number.isFinite(recent) && recent >= 0 ? Math.min(Math.floor(recent), 5000) : DEFAULT_RECENT_LIMIT,
    backfill: config.backfill === undefined ? true : config.backfill !== false,
    modelAliases: { ...DEFAULT_MODEL_ALIASES, ...stringRecord(config.modelAliases) },
    pricingRules: rules,
    pricedProviders: providers.length > 0 ? providers : [...DEFAULT_PRICED_PROVIDERS],
  }
}
