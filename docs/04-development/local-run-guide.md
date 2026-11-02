# Local Run Guide

## Install

```bash
cd E:\009workspace\dsh\token-usage-statistic
pnpm install
# or npm install
```

## Build and Check

```bash
npm run build
npm run check
node tools/check-contract.mjs
```

## Load in DSH Desktop

The desktop profile currently links this package:

```json
"token-usage-statistic": "link:E:/009workspace/dsh/token-usage-statistic"
```

To re-link from the command line, run it after fully quitting Desktop. Desktop's bundled `dsh` supports `--profile desktop`; npm `dsh` >= `0.1.5-alpha.1` rejects it:

```powershell
$dsh = "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd"
& $dsh plugin --profile desktop add E:\009workspace\dsh\token-usage-statistic
```

After changing Host code:

1. Restart DSH Desktop.
2. Open the sidebar entry `模型用量统计`.

After changing Client code:

1. Rebuild `client.js`.
2. Refresh the page (or restart the app if the webview caches the bundle).

## Load in DSH Web

```bash
dsh plugin --profile web add token-usage-statistic
dsh web
```

For local development, install the absolute directory with the plugin manager or `dsh plugin --profile web add <path>`.

## Data Directory

Default:

```text
%DSH_HOME%\token-usage-statistic\
├── usage.jsonl
├── accounts.json
└── activation.json
```

## Manual Checks

- Panel opens on Today.
- Today's data appears without a full-page loading state.
- 7/30-day switch is fast.
- Chart metric switch changes summary and bars.
- Accounts and Export tabs render.
- Export downloads are non-empty and secret-free.

## Do Not Release

Local verification is not a release. Wait for an explicit instruction.
