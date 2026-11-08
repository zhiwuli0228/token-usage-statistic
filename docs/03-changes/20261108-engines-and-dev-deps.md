# Change: engines.dsh declaration and dev dependency refresh

Date: 2026-11-08
Status: implemented

## 1. Summary

The package now declares a DSH host range through `engines.dsh` and refreshes the only outdated dev dependency (`vitest` 5.0.5 → 5.1.0). The installer's "is Desktop running" probe got a 5 s bound and `--force` now skips it, so the desktop dry-run tests stay fast and deterministic.

## 2. Problem

- **No host version gate.** DSH is in 0.2.x preview and its plugin API is still changing; a mismatched host could install and activate the plugin, then fail at runtime. Evidence: npm `latest`/`next` is `0.2.2-rc.1`, Desktop bundles `0.2.1-rc.5`, and `package.json` declared only `engines.node`.
- **Outdated dev dependency.** `npm outdated` reported `vitest` `5.0.5` → `5.1.0`; every other dev dependency was current.
- **Flaky installer tests after the upgrade.** `test/plugin-install.test.ts` timed out: `desktopAppRunning()` shells out to `tasklist`, which took ~10 s under the 16-worker test load and exceeded the 5 s default.

## 3. Approach

- Adopt the same range as the official `dsh-env-manager-plugin`:

  ```text
  >=0.2.1-rc.5 <0.3.0-0 || >=0.2.2-0 <0.3.0-0
  ```

  - the first clause covers Desktop's `0.2.1-rc.5` (and a future `0.2.1` release);
  - the second clause covers `0.2.2-*` prereleases, which npm semver would otherwise exclude;
  - `<0.3.0-0` excludes every `0.3.x` prerelease and release.
- Keep `engines.node: ">=20"`.
- Bump `vitest` to `^5.1.0` and update `pnpm-lock.yaml`.
- Bound the `tasklist`/`pgrep` probe to 5 s (`timeout: 5000`), and skip the probe when `--force` is given (`--force` already means "proceed regardless"). The two desktop dry-run tests pass `--force`; the profile-initialization test keeps exercising the refusal path.
- Rejected alternatives: a hidden env-var test hook (undocumented surface), raising test timeouts only (leaves a 10 s stall for real users), removing the running check (unsafe).

## 4. Affected Modules

- host: none.
- client: none.
- docs: `README.md` (compatibility note, install appendix, troubleshooting bullet), `docs/06-operations/installation-guide.md`, `docs/06-operations/troubleshooting.md`, `docs/00-project/current-state.md`.
- build/release: `package.json` (`engines.dsh`, `devDependencies`), `pnpm-lock.yaml`, `tools/plugin-install.mjs`, `test/plugin-install.test.ts`.

## 5. Contracts

- ledger: none.
- HTTP route: none.
- UI state / cache: none.
- export format: none.
- privacy: none.

## 6. Verification

- [x] `npm run typecheck` — pass.
- [x] `npm run test` — 135 passed across 16 files on vitest 5.1.0.
- [x] `npm run build` — pass.
- [x] `npm run test:bundle` — client bundle smoke OK.
- [x] `node tools/check-contract.mjs` — packaging contract ok for `token-usage-statistic@1.0.2`.
- [x] Semver check: accepts `0.2.1-rc.5`, `0.2.1`, `0.2.2-alpha.3`, `0.2.2-rc.1`; rejects `0.1.5`, `0.2.1-rc.4`, `0.3.0-0`, `0.3.0-rc.1`.
- [x] Live `0.2.2-rc.1` smoke (temp `DSH_HOME`, packed tarball): `plugin --profile web add <tgz>` installed; `dsh web` activation `route: "registered"` with all six routes; Playwright saw the sidebar entry and the panel (用量 / 账户 / 导出); `GET /token-usage-statistic/api/summary?days=1` returned 200 with `schemaVersion: 2`; no console errors.
- [ ] Desktop host `0.2.1-rc.5` is in range by semver but was not live-tested here (the running Desktop was not restarted).

## 7. Risks and Rollback

- Hosts on `0.1.x` (old npm web hosts) are now refused. Intended: the plugin has only been validated on 0.2.x.
- `--force` no longer prints the "app is running" note; forcing already meant taking responsibility.
- A future `0.3.x` host is refused until the range is re-verified.
- Rollback: revert `package.json`, `pnpm-lock.yaml`, `tools/plugin-install.mjs`, and `test/plugin-install.test.ts`.

## 8. Follow-ups

- Re-run the live smoke on the Desktop host once the app ships `0.2.2` or newer.
- Re-verify each new dsh rc; widen the range only after a green smoke.
- Bump the plugin version and publish only on explicit instruction.

## 9. Release

This record does not authorize a release.
