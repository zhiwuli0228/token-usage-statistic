# Installation Guide

## Compatibility

| Environment | Support | Panel |
| --- | --- | --- |
| DSH Desktop | Yes | Sidebar `模型用量统计` |
| DSH Web (`dsh web`) | Yes | Same sidebar panel |
| DSH CLI / headless | Collection only | No panel; HTTP export depends on the Web carrier |

Desktop and Web use separate profiles. Installing in one does not install in the other.

## Prerequisites

- Node.js >= 20 for source builds/dev
- Initialized DSH profile (`desktop` or `web`)
- npm registry access for the npm install path
- DeepSeek account or provider credentials for balance queries

## npm Package (Recommended)

### DSH Desktop

1. Open **Plugins**.
2. Search or enter `token-usage-statistic`.
3. Install.
4. Restart DSH Desktop (Host code loads at startup).
5. Open the sidebar entry.

If the catalog has not synced, install by package name directly.

Agent tool form:

```text
plugin_manager( action: "install_bundle", target: "token-usage-statistic" )
```

### DSH Web

```bash
dsh plugin --profile web add token-usage-statistic
dsh web
```

## GitHub Source

```bash
dsh plugin --profile web add github:zhiwuli0228/token-usage-statistic
```

Desktop: clone locally, then use the local-directory path.

## Local Directory (Development)

```text
plugin_manager( action: "install_bundle", target: "E:\\009workspace\\dsh\\token-usage-statistic" )
```

Web profile:

```bash
dsh plugin --profile web add E:\009workspace\dsh\token-usage-statistic
```

Then:

```bash
npm install
npm run build
```

Restart the Host and refresh the page.

## Manual Patch (Advanced)

Add the package to the profile dependency list and insert:

```yaml
- insert:
    - id: token-usage-statistic
      name: token-usage-statistic
```

Then reload the profile.

## Post-install Checks

```bash
dsh plugin --profile web list | findstr token-usage-statistic
```

The Desktop **Plugins** page should show the package enabled.

Panel entry: sidebar → `模型用量统计`.

## Data Location

```text
%DSH_HOME%\token-usage-statistic\usage.jsonl
```

Override with `dataFile`.
