#!/usr/bin/env node
/**
 * `npm run plugin:install -- <desktop|web>` — install this plugin into the
 * named DSH profile using the CLI that target actually loads.
 *
 * Why this exists: the desktop app does not put its `dsh` on PATH. It ships a
 * runtime (Node + pnpm + dsh) under `<app>/resources/runtime/cli/bin`, and that
 * is the only CLI whose version matches the app's profile. Typing `dsh` may
 * find nothing, or an older npm install that rejects `--profile desktop`. This
 * script locates the bundled CLI itself, so no `dsh` command is required.
 *
 * The default specifier is this working tree (pnpm links it), which is what a
 * local, not-yet-published checkout needs. Use `--npm` for the published
 * package, or `--spec` for anything else.
 *
 * Usage:
 *   npm run plugin:install -- desktop
 *   npm run plugin:install -- web --npm
 *   npm run plugin:install -- desktop --offline
 *   npm run plugin:install -- desktop --dry-run
 *   npm run plugin:remove  -- desktop
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve, win32 } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const NAME = 'token-usage-statistic'
const TARGETS = ['desktop', 'web']

const USAGE = `usage: npm run plugin:install -- <${TARGETS.join('|')}> [options]

  desktop   用 Desktop 自带的 dsh（自动查找；不需要 PATH 上有 dsh）
  web       用 PATH 上的 dsh（npm i -g @deepseek-ai/dsh）

  --npm            安装 npm 上的 ${NAME}（默认：链接当前仓库）
  --spec <spec>    显式指定 pnpm 安装 spec
  --offline        让 pnpm 不访问 registry（本地目录/tarball 可用）
  --home <dir>     DSH_HOME（默认 $DSH_HOME，再退回 ~/.dsh）
  --cli <path>     显式指定 DSH CLI（默认按目标自动查找）
  --dry-run        只打印将执行的命令，不写任何东西
  --force          Desktop 正在运行时也继续（默认拒绝）
  --remove         卸载而不是安装
  --help           显示本说明

关于 dsh：它是 DeepSeek Harness 的命令行入口。桌面版把一整套运行时（含
Node、pnpm 和 dsh）放在安装目录里，默认不加入 PATH，所以直接敲 dsh 可能
找不到，或者命中的是另一个 npm 全局版本。本脚本会自动定位桌面版自带的
那一个，因此不需要你手动配置 PATH。`

/** A usage error: printed without a stack trace. */
export class UsageError extends Error {}

/** Read one flag's value, or throw a usage error naming it. */
function valueOf(argv, index, flag) {
	const next = argv[index + 1]
	if (next === undefined || next.startsWith('--')) throw new UsageError(`${flag} needs a value`)
	return next
}

/**
 * Parse the command line into one explicit plan.
 * @param {string[]} argv - arguments after the script name.
 * @returns {{target: string, npm: boolean, spec: string|undefined, offline: boolean, home: string|undefined, cli: string|undefined, dryRun: boolean, force: boolean, remove: boolean, help: boolean}}
 */
export function parseArgs(argv) {
	const plan = { target: '', npm: false, spec: undefined, offline: false, home: undefined, cli: undefined, dryRun: false, force: false, remove: false, help: false }
	const rest = []
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index]
		if (arg === '--help' || arg === '-h') plan.help = true
		else if (arg === '--npm') plan.npm = true
		else if (arg === '--offline') plan.offline = true
		else if (arg === '--dry-run') plan.dryRun = true
		else if (arg === '--force') plan.force = true
		else if (arg === '--remove') plan.remove = true
		else if (arg === '--spec') plan.spec = valueOf(argv, index++, arg)
		else if (arg === '--home') plan.home = valueOf(argv, index++, arg)
		else if (arg === '--cli') plan.cli = valueOf(argv, index++, arg)
		else if (arg.startsWith('--')) throw new UsageError(`unknown flag ${arg}`)
		else rest.push(arg)
	}
	if (plan.help) return { ...plan, target: rest[0] ?? '' }
	if (rest.length === 0) throw new UsageError(`missing target — say ${TARGETS.join(' or ')} (npm run plugin:install -- <${TARGETS.join('|')}>, or --help)`)
	if (rest.length > 1) throw new UsageError(`expected one target, got ${rest.join(' ')}`)
	if (!TARGETS.includes(rest[0])) throw new UsageError(`unknown target "${rest[0]}" — ${TARGETS.join(' or ')}`)
	return { ...plan, target: rest[0] }
}

/** Normalise a path without mangling the other platform's syntax. */
function absolute(value) {
	return isAbsolute(value) || win32.isAbsolute(value) ? value : resolve(value)
}

/** The profile root: explicit --home, $DSH_HOME, else ~/.dsh. */
export function resolveHome(env, home) {
	if (home !== undefined) return absolute(home)
	if (typeof env.DSH_HOME === 'string' && env.DSH_HOME.length > 0) return absolute(env.DSH_HOME)
	return join(env.USERPROFILE ?? env.HOME ?? homedir(), '.dsh')
}

/** The directory of one target's profile. */
export function resolveProfileDir(home, target) {
	return join(home, 'profiles', target)
}

/**
 * Where the desktop app keeps its harness CLI, in probe order.
 * @param {string} platform - process.platform.
 * @param {NodeJS.ProcessEnv} env - environment.
 * @returns {string[]} candidate CLI paths.
 */
export function desktopCliCandidates(platform, env) {
	const relative = ['resources', 'runtime', 'cli', 'bin']
	if (platform === 'win32') {
		const local = env.LOCALAPPDATA ?? join(env.USERPROFILE ?? '', 'AppData', 'Local')
		return [
			join(local, 'Programs', 'DeepSeek Harness', ...relative, 'dsh.cmd'),
			join(env.ProgramFiles ?? 'C:\\Program Files', 'DeepSeek Harness', ...relative, 'dsh.cmd'),
			join(local, 'DeepSeek Harness', ...relative, 'dsh.cmd')
		]
	}
	if (platform === 'darwin') {
		return [
			'/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh',
			join(env.HOME ?? '', 'Applications', 'DeepSeek Harness.app', 'Contents', 'Resources', 'runtime', 'cli', 'bin', 'dsh')
		]
	}
	return [
		'/opt/DeepSeek Harness/resources/runtime/cli/bin/dsh',
		'/usr/lib/deepseek-harness/resources/runtime/cli/bin/dsh',
		join(env.HOME ?? '', '.local', 'share', 'DeepSeek Harness', 'resources', 'runtime', 'cli', 'bin', 'dsh')
	]
}

/**
 * Resolve the CLI to run.
 * @param {object} plan - parsed arguments.
 * @param {NodeJS.ProcessEnv} env - environment.
 * @param {string} platform - process.platform.
 * @returns {{command: string, source: string}} the CLI and how it was found.
 */
export function resolveCli(plan, env, platform) {
	const explicit = plan.cli ?? env.DSH_PLUGIN_INSTALL_CLI
	if (explicit !== undefined) {
		if (!existsSync(explicit)) throw new UsageError(`--cli points at nothing: ${explicit}`)
		return { command: explicit, source: 'explicit' }
	}
	if (plan.target === 'web') {
		const probe = spawnSync(platform === 'win32' ? 'where' : 'which', ['dsh'], { encoding: 'utf8' })
		const found = probe.status === 0 ? probe.stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean) : []
		// On Windows npm also drops an extension-less shim; a shell-less spawn
		// cannot execute that one, so prefer the .cmd/.exe.
		const runnable = platform === 'win32' ? (found.find((entry) => /\.(?:cmd|exe)$/iu.test(entry)) ?? found[0]) : found[0]
		if (runnable === undefined) throw new UsageError('no `dsh` on PATH — install it (npm i -g @deepseek-ai/dsh) or pass --cli <path>')
		return { command: runnable, source: 'PATH' }
	}
	for (const candidate of desktopCliCandidates(platform, env)) {
		if (existsSync(candidate)) return { command: candidate, source: 'desktop app' }
	}
	throw new UsageError(`no DeepSeek Harness desktop install found — pass --cli <path to the app's dsh>.
Probed:
${desktopCliCandidates(platform, env).map((candidate) => `  ${candidate}`).join('\n')}`)
}

/** Whether the desktop app is running (best effort). */
export function desktopAppRunning(platform) {
	try {
		if (platform === 'win32') {
			const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq DeepSeek Harness.exe', '/NH'], { encoding: 'utf8', timeout: 5000, windowsHide: true })
			return /DeepSeek Harness\.exe/iu.test(out)
		}
		const out = execFileSync('pgrep', ['-f', 'DeepSeek Harness'], { encoding: 'utf8', timeout: 5000 })
		return out.trim().length > 0
	} catch {
		return undefined
	}
}

/** The specifier to install: explicit, published, or this checkout. */
export function installSpec(plan) {
	if (plan.spec !== undefined) return plan.spec
	return plan.npm ? NAME : ROOT
}

/**
 * Build the CLI invocation.
 * @param {object} plan - parsed arguments.
 * @param {string} [spec] - install specifier.
 * @returns {string[]} CLI arguments.
 */
export function buildArgs(plan, spec = installSpec(plan)) {
	if (plan.remove) return ['plugin', '--profile', plan.target, 'remove', NAME]
	const args = ['plugin', '--profile', plan.target, 'add', spec]
	if (plan.offline) args.push('--offline')
	return args
}

/**
 * Turn a CLI invocation into something spawnSync can start. On Windows a .cmd
 * shim must go through cmd.exe, and the command string is quoted here because
 * the app path contains a space.
 * @returns {{command: string, args: string[], shell?: boolean}}
 */
export function spawnPlan(command, args, platform) {
	if (platform !== 'win32' || !/\.(?:cmd|bat)$/iu.test(command)) return { command, args }
	const quoted = [command, ...args].map((part) => `"${part.replaceAll('"', '""')}"`).join(' ')
	return { command: quoted, args: [], shell: true }
}

/** Render a command for humans, quoting only parts that need it. */
function display(command, args) {
	return [command, ...args].map((part) => (part.includes(' ') ? `"${part}"` : part)).join(' ')
}

/** Print the target-specific restart step. */
function printNextSteps(target, remove) {
	const verb = remove ? '卸载' : '安装'
	console.log('')
	if (target === 'desktop') {
		console.log(`next: 完全退出 DeepSeek Harness（含托盘图标），再重新打开；Host 代码只在启动时加载。`)
		console.log(`      侧栏应${remove ? '不再出现' : '出现'}「模型用量统计」。`)
		return
	}
	console.log(`next: 重启 dsh web（Ctrl+C 后重新执行），再在浏览器硬刷新（Ctrl/Cmd+Shift+R）。`)
}

/**
 * Run the plan.
 * @param {string[]} argv - command line after the script name.
 * @param {{env?: NodeJS.ProcessEnv, platform?: string, log?: (line: string) => void, run?: Function}} [options]
 * @returns {number} exit code.
 */
export function main(argv, options = {}) {
	const env = options.env ?? process.env
	const platform = options.platform ?? process.platform
	const log = options.log ?? console.log

	const plan = parseArgs(argv)
	if (plan.help) {
		log(USAGE)
		return 0
	}

	const home = resolveHome(env, plan.home)
	const profileDir = resolveProfileDir(home, plan.target)
	const cli = resolveCli(plan, env, platform)
	const spec = installSpec(plan)
	const args = buildArgs(plan, spec)

	log(`target   ${plan.target}`)
	log(`profile  ${profileDir}`)
	log(`cli      ${cli.command} (${cli.source})`)
	if (!plan.remove) log(`spec     ${spec}`)
	log(`action   ${plan.remove ? 'remove' : 'add'}`)

	if (plan.target === 'desktop') {
		if (!existsSync(join(profileDir, 'package.json'))) {
			log('')
			log(`not ready: ${profileDir} has no package.json.`)
			log('先完整启动一次 DeepSeek Harness，让它初始化 profile，再完全退出，然后重跑本命令。')
			return 1
		}
		const running = plan.force ? false : desktopAppRunning(platform)
		if (running === true) {
			if (plan.dryRun) {
				log('note     DeepSeek Harness 正在运行 —— 真正安装前必须完全退出（--dry-run 不受影响）。')
			} else {
				log('')
				log('refused: DeepSeek Harness 正在运行，桌面 profile 被 App 占用。')
				log('完全退出 App（含托盘）后重跑；确认无误可加 --force。')
				return 1
			}
		}
		if (running === undefined) log('note     无法确认桌面 App 是否在运行 —— 请自行确保已完全退出。')
	}

	const shown = display(cli.command, args)
	if (plan.dryRun) {
		log('')
		log(`dry-run: ${shown}`)
		return 0
	}

	log('')
	log(`run      ${shown}`)
	const spawn = options.run ?? ((command, commandArgs) => {
		const planSpawn = spawnPlan(command, commandArgs, platform)
		return spawnSync(planSpawn.command, planSpawn.args, {
			stdio: 'inherit',
			shell: planSpawn.shell ?? false,
			env: { ...env, DSH_HOME: home }
		})
	})
	const result = spawn(cli.command, args)
	if (result.error !== undefined) {
		log(`failed: ${result.error.message}`)
		return 2
	}
	if (result.status !== 0) {
		log(`failed: exit ${result.status ?? result.signal ?? 'unknown'}`)
		return 2
	}
	printNextSteps(plan.target, plan.remove)
	return 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	try {
		process.exitCode = main(process.argv.slice(2))
	} catch (error) {
		if (error instanceof UsageError) {
			console.error(`error: ${error.message}`)
			process.exitCode = 1
		} else {
			throw error
		}
	}
}
