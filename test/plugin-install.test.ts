import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SCRIPT = join(process.cwd(), 'tools', 'plugin-install.mjs')

function run(args: string[]) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', cwd: process.cwd() })
}

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'dsh-plugin-install-'))
  const desktop = join(home, 'profiles', 'desktop')
  mkdirSync(desktop, { recursive: true })
  writeFileSync(
    join(desktop, 'package.json'),
    JSON.stringify({ name: 'dsh-profile-desktop', private: true, dependencies: {}, dsh: { profile: { bundles: [] } } })
  )
  return home
}

function fakeCli(home: string): string {
  const cli = join(home, 'dsh.cmd')
  writeFileSync(cli, '@echo off\r\n')
  return cli
}

describe('plugin-install script', () => {
  it('prints help without a target', () => {
    const result = run(['--help'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('npm run plugin:install')
    expect(result.stdout).toContain('dsh')
  })

  it('rejects a missing target', () => {
    const result = run([])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('missing target')
  })

  it('rejects an unknown target', () => {
    const result = run(['tui'])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('unknown target "tui"')
  })

  it('dry-runs a desktop install with an explicit CLI', () => {
    const home = tempHome()
    try {
      const result = run(['desktop', '--home', home, '--cli', fakeCli(home), '--dry-run', '--force'])
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('dry-run:')
      expect(result.stdout).toContain('plugin --profile desktop add')
      expect(result.stdout).toContain('action   add')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('dry-runs a web install with an explicit CLI', () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-plugin-install-'))
    try {
      const result = run(['web', '--home', home, '--cli', fakeCli(home), '--dry-run'])
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('plugin --profile web add')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('adds --offline only to an install', () => {
    const home = tempHome()
    try {
      const cli = fakeCli(home)
      const install = run(['desktop', '--home', home, '--cli', cli, '--dry-run', '--offline', '--force'])
      expect(install.status).toBe(0)
      expect(install.stdout).toContain('--offline')
      const remove = run(['desktop', '--home', home, '--cli', cli, '--dry-run', '--remove', '--offline', '--force'])
      expect(remove.status).toBe(0)
      expect(remove.stdout).toContain('remove token-usage-statistic')
      expect(remove.stdout).not.toContain('--offline')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('refuses a desktop install when the profile is not initialized', () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-plugin-install-'))
    try {
      const result = run(['desktop', '--home', home, '--cli', fakeCli(home), '--dry-run'])
      expect(result.status).toBe(1)
      expect(result.stdout).toContain('has no package.json')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})
