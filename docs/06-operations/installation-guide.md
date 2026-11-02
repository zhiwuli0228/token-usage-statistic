# Installation Guide

## Compatibility

| Environment | Support | Panel |
| --- | --- | --- |
| DSH Desktop | Yes | Sidebar `模型用量统计` |
| DSH Web (`dsh web`) | Yes | Same sidebar panel |
| DSH CLI / headless | Collection only | No panel; HTTP export depends on the Web carrier |

Desktop and Web use separate profiles (`desktop` / `web`). Installing in one does not install in the other.

## The Desktop CLI Entry Point

Desktop installs use `dsh plugin --profile desktop ...`. Whether that command works as typed depends on where `dsh` comes from.

`dsh` is the DeepSeek Harness CLI. Desktop does **not** add its bundled CLI to PATH: typing `dsh` may find nothing, or a different npm-installed version. This repository ships a wrapper that finds it:

```powershell
npm run plugin:install -- desktop
```

It locates the app's CLI, checks that Desktop is quit, and links the current checkout into the `desktop` profile. `--npm` installs the published package, `--offline` skips the registry, `--dry-run` only prints the command, and `--remove` uninstalls.

The manual instructions below apply outside the repository, or when calling the CLI directly.

| Source of `dsh` | `--profile desktop` |
| --- | --- |
| The `dsh` shipped with Desktop | Supported; pnpm is bundled |
| npm package `@deepseek-ai/dsh` <= `0.1.3` | Supported (early versions had no restriction) |
| npm package `@deepseek-ai/dsh` >= `0.1.5-alpha.1` (including current `0.2.1-rc.5`) | Rejected |

A newer npm CLI reports:

```text
error: profile "desktop" is managed exclusively by the Electron application
```

Check which one is active:

```powershell
where.exe dsh
dsh --version
```

A path under `...\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd` works directly. If it resolves to the npm global CLI (`...\npm\dsh.cmd`) at `>= 0.1.5-alpha.1`, use Desktop's bundled `dsh` instead:

- **Windows**: by default (per-user install) at `%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd`; substitute the real install directory when Desktop lives elsewhere.
- **macOS**: application menu → **Manage dsh Command…** → **Install**, then use `dsh` directly.

The examples below use `$dsh` for the full path to Desktop's `dsh`. Define it once in a new PowerShell window:

```powershell
$dsh = "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd"
& $dsh plugin --profile desktop list
```

Fully quit Desktop (including the tray icon) before an install or removal, then start it again. Host code loads only at startup.

> Older npm CLIs worked because they had no desktop restriction. Newer ones reject `--profile desktop` outright; it is not a path or argument-syntax problem.

## Prerequisites

- Node.js >= 20 for source builds/dev
- An initialized DSH profile: Desktop must have started at least once (it creates the `desktop` profile); Web is initialized by `dsh web` or the first `dsh plugin --profile web`
- npm registry access for the npm install path
- For hosts with no npm registry access, use the offline local install below (`--offline`); no registry is needed
- Desktop does not require `dsh` on PATH: `npm run plugin:install -- desktop` finds the app's bundled CLI
- `pnpm` on PATH when using the npm-installed `dsh plugin` (Desktop's bundled `dsh` already contains pnpm)
- DeepSeek account or provider credentials for balance queries

## npm Package (Recommended)

### DSH Desktop

Graphical:

1. Open **Plugins**.
2. Search or enter `token-usage-statistic`.
3. Install.
4. Restart DSH Desktop (Host code loads at startup).
5. Open the sidebar entry.

The plugin is not in the official catalog yet (the code has not been merged into the official repository), so it does not appear in Discover; install by package name directly. On a host without npm access, use the offline local install below.

Command line (equivalent):

```powershell
# Fully quit Desktop first
& $dsh plugin --profile desktop add token-usage-statistic
# Then start Desktop
```

On success the package joins the `desktop` profile's `dsh.profile.bundles` and loads on the next start.

You can also run `npm run plugin:install -- desktop --npm` to let the wrapper find the CLI.

Inside a Desktop session, an agent can also run (the tool targets the current session's profile):

```text
plugin_manager( action: "install_bundle", target: "token-usage-statistic" )
```

### DSH Web

```bash
dsh plugin --profile web add token-usage-statistic
dsh web
```

## GitHub Source

```powershell
# Web
dsh plugin --profile web add github:zhiwuli0228/token-usage-statistic

# Desktop (fully quit Desktop first)
& $dsh plugin --profile desktop add github:zhiwuli0228/token-usage-statistic
```

Git-hosted installs need `git` on PATH. If pnpm blocks a package build script, add the exact key it prints under `allowBuilds` in that profile's `pnpm-workspace.yaml`, then re-run.

## Local Install (Not in the Catalog / No npm Access)

The plugin is not in the official catalog, and some hosts cannot reach npm. Both cases use a local copy. No build step is required: the repository ships `index.js`, `client.js`, and the other runtime files.

**From this repository (recommended)**

```powershell
npm run plugin:install -- desktop
npm run plugin:install -- desktop --offline
npm run plugin:install -- web
```

The wrapper finds Desktop's bundled CLI, checks that the app is quit, and links this checkout. `--npm` installs the published package instead.

**Prepare on a machine that has the source**

- Copy the whole directory, keeping at least `package.json`, `index.js`, `client.js`, `cordis.patch.yml`, `locale/`, and `icon.svg`.
- Or build a tarball with `npm pack` in the repository root; it produces `token-usage-statistic-<version>.tgz`.

**DSH Desktop**

```powershell
# Fully quit Desktop first
$dsh = "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd"

# Directory: linked install; keep the source directory in place
& $dsh plugin --profile desktop add "D:\offline\token-usage-statistic" --offline

# Or tarball: copied into the profile; the source can move away (keep the tgz for reinstall)
& $dsh plugin --profile desktop add "D:\offline\token-usage-statistic-1.0.2.tgz" --offline

# Then start Desktop
```

`--offline` keeps pnpm away from the registry; a local directory or tarball needs no network. Desktop's bundled `dsh` already contains pnpm, so the target host needs nothing else.

**DSH Web**

```powershell
dsh plugin --profile web add "D:\offline\token-usage-statistic" --offline
# or
dsh plugin --profile web add "D:\offline\token-usage-statistic-1.0.2.tgz" --offline

dsh web
```

The Web path uses the npm-installed `dsh`, so `pnpm` must be on PATH; without pnpm, prefer installing through Desktop (its bundled pnpm targets the `desktop` profile), or prepare pnpm offline first.

**Agent-driven, from a Desktop session**

```text
plugin_manager( action: "install_bundle", target: "D:\\offline\\token-usage-statistic" )
```

`plugin_manager` targets the current session's profile: a Desktop session installs into `desktop`, a Web session into `web`.

**Rebuild only after changing `src/`**

```bash
npm install
npm run build
```

A plain install uses the committed build output and needs no `npm install`. After a rebuild, restart the Host and refresh the page; source edits alone do not take effect.

## Manual Patch (Advanced)

Add the package to the profile's `package.json` dependencies and insert into that profile's `cordis.patch.yml`:

```yaml
- insert:
    - id: token-usage-statistic
      name: token-usage-statistic
```

Profile directories:

- Desktop: `%DSH_HOME%\profiles\desktop`
- Web: `%DSH_HOME%\profiles\web`

Then reload the profile. Hand-edited patches can collide with Desktop's profile recovery; prefer `dsh plugin`.

## Post-install Checks

```powershell
# Web
dsh plugin --profile web list | findstr token-usage-statistic

# Desktop
& $dsh plugin --profile desktop list | findstr token-usage-statistic
```

The output should list `token-usage-statistic@` (a registry or tarball install shows the version; a local directory link shows its `link:` path). The Desktop **Plugins** page should also show it enabled.

Panel entry: sidebar → `模型用量统计`.

## Removal

```powershell
dsh plugin --profile web remove token-usage-statistic
& $dsh plugin --profile desktop remove token-usage-statistic
```

Removal does not delete the ledger; `usage.jsonl` is retained.

## Data Location

```text
%DSH_HOME%\token-usage-statistic\usage.jsonl
```

Override with `dataFile`.
