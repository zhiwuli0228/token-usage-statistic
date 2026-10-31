# token-usage-statistic

DeepSeek Harness（DSH）插件：统计**本机所有模型调用**的 token 用量与**按事件时间估算的费用**，并提供历史回填与侧边栏面板。同时适配 DSH Desktop 与 DSH Web —— 两者加载同一份 Web 客户端包和同一套 Host 插件图，因此只有一份实现。

`0.2.0` 是一次 TypeScript 重写：Host 与 Client 都在 `src/` 下用 TS 编写，由 esbuild 产出可安装的 `index.js` / `client.js`。

## 能力

- **三种采样来源**：`assistant/message`（提交步）、`assistant/chunk`（实时 usage chunk）、`compaction/summary`（压缩摘要调用）；同一 `turn:step` 的后续样本**替换**先前样本，而不是重复累加。
- **历史回填**：启动后在后台增量扫描 `sessionPersistence` 中已有的会话；账本里每个会话的最高 seq 就是游标，只读尾部。fork 子会话从 `inheritedEventCount` 开始读，避免重复计入父会话的复制事件。
- **费用估算**：每个样本用**自己的事件时间**匹配历史价格规则（含 DeepSeek 官方峰谷时段、上海时区），替换样本先减旧价再加新价；未知路由/模型/时间段一律标记为「未定价」，金额整体 fail-closed，不拿部分和冒充总额。
- **聚合视图**：按提供方 → 模型、按日、按会话；缓存命中率、输入/输出/缓存读/写四类 token。
- **面板**：今日 / 近 7 天 / 近 30 天 / 全部，费用与未定价提示、历史回填进度、按提供方分组的模型排行、按日与按会话明细；中英文文案跟随界面语言。

## 架构

```
Session 事件（DSH 的真相来源）
  assistant/message · assistant/chunk · compaction/summary
        │
        ▼
┌──────────────────── Host（src/host）────────────────────┐
│ collector  事件 → 样本（route/turn:step/usage）          │
│ pricing    事件时间 → 单价规则 → 单样本费用              │
│ store      样本 → 日/模型/会话折叠（替换＝先减后加）      │
│ ledger     每次接受追加一行 JSONL（可重放）              │
│ backfill   sessionPersistence 增量补历史（后台、限并发）  │
│ api        GET /token-usage-statistic/api/summary        │
└──────────────────────────────────────────────────────────┘
        │ same-origin fetch
        ▼
┌──────────────────── Client（src/client）─────────────────┐
│ sidebar.panellist  侧边栏行（文案 thunk 跟随语言）        │
│ main (key=token-usage) 面板：指标、提供方/模型、日、会话  │
└──────────────────────────────────────────────────────────┘
```

设计要点：

- **账本是唯一可重放的来源**。内存折叠是从账本重建的派生态；重启、热更新、重装都不会丢统计。
- **费用不落盘**。账本只存原始 token 桶与路由，费用在重放时按价格规则重新计算 —— 价格表更新后可以重算历史，而不会把「当前价 × 历史量」写死。
- **替换是双向算术**。新增样本与减去被替换样本是同一个操作的两个方向，所以 chunk → message 的升级、以及历史回填与实时采集的竞态都能保持精确。
- **同源 HTTP 而不是生成式 Remote**。零构建依赖的只读接口足以支撑面板；路由必须注册为 `exact`（当前 Web 载体接受 `prefix` 注册但不派发）。

## 目录

```
src/host/usage.ts       纯函数：token 桶、日键、事件采样、v1→v2 迁移
src/host/pricing.ts     DeepSeek 历史价格表、峰谷规则、模型别名
src/host/cost.ts        费用累加器与 fail-closed 渲染
src/host/store.ts       折叠、替换、范围过滤、快照
src/host/ledger.ts      JSONL 串行追加与坏行跳过
src/host/collector.ts   事件 → 样本，route 回退
src/host/backfill.ts    持久化会话的增量回填（含 fork 边界）
src/host/api.ts         只读 HTTP 接口
src/host/config.ts      配置归一化
src/host/index.ts       Host 入口 apply()
src/client/*.ts         React 面板、格式化、i18n、React 绑定
index.js / client.js    esbuild 构建产物（仓库内提交，供直接安装）
test/                   vitest 单元测试（85 个）
scripts/smoke-client.mjs 对构建后的 client.js 做假 shell 冒烟
```

## 安装

本仓库是 bundle 包（`package.json` 的 `dsh.bundle.patch`），且已提交构建产物。用插件管理器按绝对路径安装：

```
plugin_manager( action: "install_bundle", target: "E:\\009workspace\\dsh\\token-usage-statistic" )
```

从 GitHub 安装时先 `git clone` 到本地再按目录安装（或发布到 npm 后按包名安装）。安装后侧边栏出现「模型用量统计」入口。

> 本地目录是链接安装。**修改 `src/` 后必须 `npm run build`**，把 `index.js` / `client.js` 更新；只改源码不会生效。

## 配置

所有字段可选，非法值回退默认：

```yaml
- override:
    - id: token-usage-statistic
      config:
        dataFile: 'D:\\dsh-data\\usage.jsonl'   # 默认 $DSH_HOME/token-usage-statistic/usage.jsonl
        refreshMs: 60000                        # 面板轮询，最小 3000，默认 15000
        sessionLimit: 12                        # 会话表条数，1..100
        recentLimit: 200                        # 内存保留的最近样本，0..5000
        backfill: true                          # 是否回填历史会话
        modelAliases:                           # 额外模型别名（覆盖内置）
          deepseek-flash: deepseek-v4-flash
        pricing:
          providers: [deepseek, deepseek-account, deepseek-official]  # 视为官方路由、可计价
          rules: []                             # 追加自定义价格规则（结构见 src/host/pricing.ts）
```

## 价格口径

内置目录为 DeepSeek 官方 USD 价（每 1M tokens），覆盖 `deepseek-v4-flash` / `deepseek-v4-pro` 的三段历史：平价期、全周峰谷期、工作日峰谷期；峰时段为上海时间 09:00–12:00 与 14:00–18:00。

- 桌面账号路由上报的 `deepseek-flash` / `deepseek-pro` 通过内置别名映射到 `v4` 规则；这是本插件的假设，可用 `modelAliases` 覆盖。
- 只有 `providers` 列表内的路由会被计价；第三方网关（如 `huawei`、`openrouter`）默认**未定价**。
- 任一样本缺少可靠单价时，该层级的金额为 `null`，面板显示「—」并提示未定价样本数；token 总数不受影响。
- 费用是**估算**，不是账单；不读取、不保存任何凭据。

## API

`GET /token-usage-statistic/api/summary`

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `days` | `30` | 近 N 天；`all` 表示全部；最大 3650 |
| `sessions` | `12` | 会话表条数，最大 100 |
| `recent` | `20` | 最近样本条数，最大 100 |

响应要点（`schemaVersion: 2`）：

```jsonc
{
  "totals": { "calls": 4820, "tokens": 1161557017, "cacheHitRate": 92.4,
              "cost": { "amount": null, "currency": "USD", "complete": false, "pricedCalls": 4624, "unpricedCalls": 196 } },
  "byProvider": [{ "provider": "deepseek-official", "tokens": 1083198724, "cost": { "amount": 11.62, "currency": "USD", "complete": true },
                   "models": [{ "model": "deepseek-flash", "calls": 3540, "tokens": 934083952, "cost": { "amount": 10.03 } }] }],
  "byDay": [{ "day": "2026-10-31", "calls": 120, "tokens": 12345678, "cost": { "amount": 0.42 } }],
  "sessions": [{ "sessionId": "session-…", "calls": 42, "tokens": 123456, "firstAt": 1790000000000, "lastAt": 1790000000000 }],
  "counts": { "samples": 4820, "sessions": 47, "days": 11, "models": 5, "unpriced": 196 },
  "backfill": { "state": "done", "sessions": 62, "events": 32440, "skipped": 0, "inherited": 0 },
  "pricing": { "ruleIds": ["deepseek-v4-flash-usd-weekday-schedule"], "currency": "USD" }
}
```

接口只读、仅本机、`cache-control: no-store`。

## 数据与迁移

- 账本：默认 `%DSH_HOME%\token-usage-statistic\usage.jsonl`，一行一个样本。
- `activation.json`：每次激活的路由回执（`registered` / 失败原因），排障用，可删。
- v1 记录（无 `sampleKey`）在加载时自动迁移为 `assistant:<seq>`，不影响旧统计。
- 想清空重来：停用插件 → 删除 `usage.jsonl` → 启用（会重新回填历史）。重置前建议先备份。

## 开发

```powershell
npm install
npm run build      # esbuild → index.js + client.js
npm run typecheck  # tsc --noEmit
npm test           # vitest，85 个用例
npm run test:bundle # 对构建后的 client.js 做假 shell 冒烟
npm run check      # typecheck + build + test
```

改完 Host 代码后，将插件行 `include:token-usage-statistic` 禁用再启用即可重新导入模块（无需重启应用）；Client 代码刷新页面即可。

## 排障

- **面板 404**：看 `activation.json`。`route: "failed"` 带原因；文件不存在说明 `webServer` 未注入。
- **面板空态**：新消息提交后才会产生样本；可点刷新。
- **历史回填**：面板会显示「正在回填历史会话」；完成后状态变为 `done`。若 `sessionPersistence` 不可用，只统计实时用量。
- **费用为「—」**：存在未定价路由/模型，见面板提示与 `counts.unpriced`；用 `pricing.providers` / `modelAliases` / `pricing.rules` 扩展。

## 范围与限制

- 不做账户余额、订阅额度、预算与导出；这些属于参考项目 `dsh-usage-stats` 的另一条产品线，本插件当前只做用量与费用。
- 价格目录只覆盖 DeepSeek 官方；第三方网关默认未定价（fail-closed）。
- 账本没有轮转/上限；长期使用后文件会增长。替换样本会保留历史行，重放时收敛到最终状态。
- 历史回填读取的是本进程可见的持久化会话；实时进行中的会话由事件流覆盖。
- 面板视觉呈现尚未经过真人验收（槽位注册、接口与 bundle 冒烟已通过）。

## 与参考项目的关系

采样口径、替换语义、价格规则结构与 fail-closed 费用渲染参考了 [`Ychris12138/dsh-usage-stats`](https://github.com/Ychris12138/dsh-usage-stats)（MIT）。本实现是独立的 TypeScript 代码库，只保留用量与费用这条主线，并额外把 fork 的 `inheritedEventCount` 作为回填边界。

## Roadmap

1. 账本轮转与按区间清理。
2. 月历热图与月/日预算（可选，不引入账户体系）。
3. 导出 CSV / JSON（secret-free）。
4. 更多官方 provider 价格目录与汇率。
5. 面板视觉与交互的细节打磨（对比图、模型筛选）。

## License

[MIT](LICENSE) © 2026 zhiwuli0228
