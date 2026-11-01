# Roadmap

## 1.1: History and Quota Depth

Scope:

- Ledger rotation and retention.
- More built-in subscription schemes (Qwen Token Plan, Kimi, MiniMax).
- Budget threshold notifications.
- Account refresh diagnostics in the panel.

## 1.2: Visualization

Scope:

- Monthly calendar heatmap.
- Model/provider filters on the chart.
- Better empty, partial, and stale states.
- Export presets and date-range selection.

## 1.3: Scale and Distribution

Scope:

- Incremental/paginated Host APIs for large local histories.
- Safer large-ledger replay and compaction.
- Official plugin catalog listing.
- Storefront screenshots and metadata polish.

## Later

- Optional provider pricing catalog refresh.
- Scheduled exports.
- Cross-device sync (only with explicit user opt-in and a documented privacy model).

## Release Policy

Versions are published only when the user explicitly asks for a release. Until then:

- Changes stay on `main`.
- `package.json` version is not bumped.
- No tag, npm publish, or GitHub release is created.
