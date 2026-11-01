# Release Guide

## Policy

**Do not release unless the user explicitly asks.**

No version bump, tag, npm publish, or GitHub release without that instruction.

## Current State

- Latest published: `1.0.2`
- `main` contains unreleased performance/UX work
- npm trusted publishing is configured for `zhiwuli0228/token-usage-statistic`, workflow `release.yml`

## Release Steps

1. Confirm the intended version and scope with the user.
2. Update `package.json` version.
3. Update `README.md` version line and relevant docs.
4. Run:

```bash
npm run check
node tools/check-contract.mjs
```

5. Commit and push `main`.
6. Create and push the tag:

```bash
git tag -a vX.Y.Z -m "Release token-usage-statistic X.Y.Z"
git push origin vX.Y.Z
```

7. Watch the release workflow:

```bash
gh run list --repo zhiwuli0228/token-usage-statistic --workflow=release.yml --limit 2
gh run watch <run-id> --repo zhiwuli0228/token-usage-statistic --exit-status
```

8. Verify npm:

```bash
npm view token-usage-statistic version --prefer-online
npm view token-usage-statistic dist-tags --json --prefer-online
```

9. Verify the GitHub release page.

## Workflow Behavior

The release workflow:

1. Checks that the tag matches `package.json`.
2. Runs `pnpm run check`.
3. Runs `node tools/check-contract.mjs`.
4. Publishes with `npm publish --access public --provenance`.
5. Creates a GitHub release.

## npm Propagation

The registry can take 1–2 minutes to show a new version. A fresh publish may briefly show the old `latest`; re-check with `--prefer-online`.

## Trusted Publishing

npm → package → Settings → Trusted Publisher → GitHub Actions:

```text
Organization or user : zhiwuli0228
Repository           : token-usage-statistic
Workflow filename    : release.yml
Environment          : (empty)
```

## Manual Fallback

If trusted publishing is unavailable:

```bash
npm login
npm publish --access public
```

## Do Not

- Do not publish over an existing version.
- Do not tag a version that disagrees with `package.json`.
- Do not announce a release before npm confirms it.
