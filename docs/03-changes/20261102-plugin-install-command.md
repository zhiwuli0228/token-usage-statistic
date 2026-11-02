# Change: plugin:install wrapper for Desktop and Web

Date: 2026-11-02
Status: implemented

## 1. Summary

Add `tools/plugin-install.mjs` and the `plugin:install` / `plugin:remove` npm scripts. `npm run plugin:install -- desktop` locates the CLI shipped inside DeepSeek Harness Desktop and installs this checkout into the `desktop` profile. The docs now explain what `dsh` is and why Desktop does not put it on PATH.

## 2. Problem

The installation docs assumed a `dsh` command on PATH. Desktop does not add its bundled CLI to PATH; typing `dsh` either fails or resolves to an npm install whose version may reject `--profile desktop`. A user who previously used a target-named installer script (`npm run plugin:install -- desktop`) could not reproduce that workflow in this repository: `package.json` had no such script and `tools/plugin-install.mjs` did not exist.

Evidence:

- `where.exe dsh` finds only the npm shims; the app's CLI is at `%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd`.
- `npm run` listed only build/typecheck/test scripts.
- The sibling plugin `dsh-image-router` already uses a target-named installer (`install:desktop` / `install:web`) that resolves the app's CLI.

## 3. Approach

Add one small Node script using only the standard library:

- `desktop` probes the known app locations (`%LOCALAPPDATA%\Programs\DeepSeek Harness`, `%ProgramFiles%`, macOS `/Applications`, Linux paths) and uses the bundled CLI; `web` uses `dsh` from PATH.
- The default specifier is this checkout, so pnpm creates a `link:` install for local work; `--npm` switches to the published package; `--spec` overrides.
- The script refuses to touch an initialized desktop profile while the app is running (best-effort `tasklist`/`pgrep` check), unless `--force`; `--dry-run` only prints the command.
- `--offline` is forwarded to pnpm for hosts with no registry access.
- `--home` is also passed as `DSH_HOME` to the child CLI so both resolve the same profile.

Rejected alternatives:

- Document only the full CLI path: still requires users to find and type a deep path, and does not restore the remembered command.
- Reuse `dsh plugin` directly in an npm script: cannot discover the desktop CLI or check the app-running precondition.

## 4. Affected Modules

- host: none
- client: none
- docs: `README.md`, `docs/06-operations/installation-guide.md`, `docs/06-operations/troubleshooting.md`, `AGENTS.md`, `docs/00-project/current-state.md`
- build/release: `package.json` scripts, `tools/plugin-install.mjs`, `test/plugin-install.test.ts`; no version bump, tag, or publish

## 5. Contracts

- ledger: none
- HTTP route: none
- UI state / cache: none
- export format: none
- privacy: none (the script handles paths only; no credentials)

## 6. Verification

- [x] `npm run typecheck`
- [x] `npm run test` (16 files, 135 tests)
- [x] `npm run build`
- [x] `npm run test:bundle`
- [x] `node tools/check-contract.mjs`
- [ ] Manual panel check (not a UI change)

Results:

- `npm run plugin:install -- desktop --dry-run` resolved `C:\Users\18811\AppData\Local\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd (desktop app)` and printed the expected `plugin --profile desktop add ...` command.
- A real run against a temporary `DSH_HOME` (`--home <temp> --force --offline`) installed `token-usage-statistic@link:E:/...` and appended it to `dsh.profile.bundles`.
- `test/plugin-install.test.ts` covers help, missing/unknown target, desktop/web dry runs, `--offline`/`--remove`, and the uninitialized-profile refusal.

## 7. Risks and Rollback

- The desktop CLI path is probed from known install locations. A custom install directory needs `--cli <path>`.
- The app-running check is best-effort; `--force` exists for CI or unusual setups.
- The default `link:` install points at this working tree; deleting or moving the checkout breaks the profile dependency. Use `--npm` or a tarball for a stable install.
- Rollback: delete `tools/plugin-install.mjs`, the two npm scripts, the test, and revert the docs; profiles already installed keep their dependency until removed with `npm run plugin:remove -- desktop`.

## 8. Follow-ups

- None required. A future change could add the same wrapper to the published package, but that is out of scope here.

## 9. Release

This record does not authorize a release. Wait for explicit user instruction.
