#!/usr/bin/env node
/**
 * Packaging contract check.
 *
 * CI and the release workflow both run this script so a broken manifest or
 * missing build artifact is caught before anything reaches npm.
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

function readJson(file) {
  return JSON.parse(readFileSync(path.join(root, file), 'utf8'))
}

function assert(condition, message) {
  if (!condition) {
    console.error('', message)
    process.exit(1)
  }
}

const manifest = readJson('package.json')

// 1. The patch file exists and is referenced correctly.
assert(manifest.dsh?.bundle?.patch === './cordis.patch.yml', 'dsh.bundle.patch must be ./cordis.patch.yml')
assert(existsSync(path.join(root, 'cordis.patch.yml')), 'cordis.patch.yml must exist')

// 2. Built host and client bundles exist.
for (const file of ['index.js', 'client.js']) {
  assert(existsSync(path.join(root, file)), `${file} must be built and committed`)
}

// 3. Locale and icon assets exist.
assert(existsSync(path.join(root, 'icon.svg')), 'icon.svg must exist')
const localeDir = path.join(root, 'locale')
for (const locale of ['en', 'zh']) {
  assert(existsSync(path.join(localeDir, `${locale}.json`)), `locale/${locale}.json must exist`)
}

// 4. The README mentions the same version as package.json.
const readme = readFileSync(path.join(root, 'README.md'), 'utf8')
assert(readme.includes(manifest.version), `README.md must mention version ${manifest.version}`)

// 5. The package is not accidentally private on a release build.
assert(manifest.private !== true, 'package.json must not be private for npm publish')

console.log(`✅ packaging contract ok for ${manifest.name}@${manifest.version}`)
