# token-usage-statistic

DeepSeek Harness（DSH）插件：统计**本机所有模型调用**的 token 用量与**按事件时间估算的费用**，提供历史回填、账户余额/订阅额度、日/月预算与无凭据导出，并在侧边栏面板中呈现。同时适配 DSH Desktop 与 DSH Web —— 两者加载同一份 Web 客户端包和同一套 Host 插件图，因此只有一份实现。

`1.0.0` 是首个稳定版本：在用量与费用的基础上，补齐账户余额/订阅额度、日/月预算、无凭据导出、每日用量图表，以及会话名称与工作区名称的友好展示。

## 能力

| 能力 | 说明 |
| --- | --- |
| 用量采样 | `assistant/message`、`assistant/chunk`、`compaction/summary` 三源；同一 `turn:step` 的后续样本替换先前样本 |
| 历史回填 | 启动后增量扫描 `sessionPersistence`；账本中每个会话的最高 seq 就是游标，fork 从 `inheritedEventCount` 起读 |
| 费用估算 | 每个样本按**自己的事件时间**匹配历史价格规则（DeepSeek 峰谷时段、上海时区）；未定价 fail-closed |
| 账户余额 | DSH Desktop 账户服务、官方 DeepSeek API Key、`llm-pi-ai` provider 的公开余额接口 |
| 订阅额度 | 通用 JSON Pointer 映射的额度窗口（已用/上限/剩余/重置时间），支持自定义 monitor |
| 预算 | 日/月上限、80% 预警/超限状态；费用不完整时不拿部分和比较 |
| 导出 | 按日 CSV、会话 CSV、版本化 JSON；无凭据、Excel 安全 |
| 面板 | 用量 / 账户 / 导出三个标签页，中英文文案跟随界面语言 |

## 架构

```
Session 事件（DSH 的真相来源）
  assistant/message · assistant/chunk · compaction/summary
        │
        ▼
┌──────────────────── Host（src/host）─────────────────────┐
│ collector  事件 → 样本（route/turn:step/usage）           │
│ pricing    事件时间 → 单价规则 → 单样本费用               │
│ store      样本 → 日/模型/会话折叠（替换＝先减后加）       │
│ ledger     每次接受追加一行 JSONL（可重放）               │
│ backfill   sessionPersistence 增量补历史（后台、限并发）   │
│ accounts   发现/刷新账户，凭据只在 Host 解析，结果归一化    │
│ budgets    日/月费用与上限状态                            │
│ api        summary · accounts · 3 个导出端点              │
└───────────────────────────────────────────────────────────┘
        │ same-origin fetch（仅回环）
        ▼
┌──────────────────── Client（src/client）──────────────────┐
│ sidebar.panellist  侧边栏行（文案 thunk 跟随语言）         │
│ main (key=token-usage)  面板：用量 / 账户 / 导出           │
└───────────────────────────────────────────────────────────┘
```

设计要点：

- **账本是唯一可重放的来源**。内存折叠是从账本重建的派生态；重启、热更新、重装都不会丢统计。
- **费用不落盘**。账本只存原始 token 桶与路由，费用在重放时按价格规则重新计算 —— 价格表更新后可以重算历史。
- **账户凭据不出 Host**。`credentials.resolve()` 只在每次刷新时于 Host 内调用；落盘缓存 `accounts.json` 与接口响应都只有归一化数字和粗粒度错误码。
- **网络出口有边界**。账户查询仅 HTTPS（回环允许 HTTP）、不跟随重定向、15 秒超时、1 MiB 上限、拒绝 URL 内嵌凭据。
- **同源 HTTP 而不是生成式 Remote**。路由必须是 `exact`（当前 Web 载体接受 `prefix` 注册但不派发）；所有端点只接受回环 GET/HEAD。

## 目录

```
src/host/usage.ts          纯函数：token 桶、日键、事件采样、v1→v2 迁移
src/host/pricing.ts        DeepSeek 历史价格表、峰谷规则、模型别名
src/host/cost.ts           费用累加器与 fail-closed 渲染
src/host/store.ts          折叠、替换、范围过滤、快照、导出行
src/host/ledger.ts         JSONL 串行追加与坏行跳过
src/host/collector.ts      事件 → 样本，route 回退
src/host/backfill.ts       持久化会话增量回填（含 fork 边界）
src/host/accounts/         账户类型、网络、schemes、注册表与刷新调度
src/host/budgets.ts        日/月预算
src/host/export.ts         CSV/JSON 投影与 CSV 注入防护
src/host/api.ts            只读 HTTP 路由
src/host/config.ts         配置归一化
src/host/index.ts          Host 入口 apply()
src/client/*.ts            React 面板、格式化、i18n、React 绑定
index.js / client.js       esbuild 构建产物（仓库内提交）
test/                      vitest 单元测试（120 个）
scripts/smoke-client.mjs   对构建后的 client.js 做假 shell 冒烟
```

## 安装

本仓库是 bundle 包（`package.json` 的 `dsh.bundle.patch`），且已提交构建产物。

从 npm 安装：

```
plugin_manager( action: "install_bundle", target: "token-usage-statistic" )
```

或从本地目录安装：

```
plugin_manager( action: "install_bundle", target: "E:\\009workspace\\dsh\\token-usage-statistic" )
```

从 GitHub 安装时先 clone 到本地再按目录安装。安装后侧边栏出现「模型用量统计」入口。

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
          rules: []                             # 追加自定义价格规则
        accounts:
          refreshMs: 600000                     # 账户刷新，最小 60000
          timeoutMs: 15000                      # 单次账户请求超时
          monitors:                             # 显式账户 monitor（可覆盖自动发现）
            - id: coding-plan
              displayName: Coding Plan
              mode: subscription                # balance | subscription
              baseURL: https://billing.example.com/usage
              credentialRef: MY_PLAN_API_KEY    # 由 credentials 服务解析
              subscription:
                plan: /plan/name
                windows: /data/windows
                fields:
                  id: /key
                  label: /label
                  used: /used
                  limit: /total
                  remaining: /remaining
                  unit: /unit
                  resetAt: /reset_at
        budgets:
          currency: USD
          daily: 5
          monthly: 50
```

## 账户与额度

自动发现三类来源：

1. **DSH Desktop 账户**（`deepseekAccount` Host 服务）：登录后读取充值/赠送钱包；未登录显示「未登录」。
2. **官方 DeepSeek API Key**（`llm-deepseek`）：`GET /user/balance`。
3. **`llm-pi-ai` provider**：按 provider id 或 host 匹配内置 scheme（DeepSeek、Moonshot、Z.AI、OpenRouter、OrcaRouter）；没有公开接口的 provider 显示「无公开接口」，不会发起猜测性请求。

`accounts.monitors` 可以补上任意私有监控端点：`baseURL` 必须是完整 URL，数值用 JSON Pointer 选取；`mode: subscription` 时用 `windows` 指针选取额度数组。

- 刷新在后台进行（默认 10 分钟），面板「刷新账户」会立即触发一次。
- 最近一次结果写入 `accounts.json`，重启后先显示旧值并标记 stale，直到刷新成功。
- 凭据只经 `ctx.credentials` 在 Host 内解析，响应与导出都不含密钥、请求头或上游原始 JSON。

## 预算

`budgets.daily` / `budgets.monthly` 与 `budgets.currency` 定义上限。预算只汇总面板已经展示的同一批费用估算：

- 达到 80% 为 `warn`，达到 100% 为 `exceeded`；
- 窗口内任一样本未定价或币种不一致时，`costComplete: false`，不下结论、不显示百分比；
- 未配置上限时不显示预算条。

## 导出

| 端点 | 内容 |
| --- | --- |
| `GET /token-usage-statistic/api/export/daily.csv` | 每行一个日期 + provider + model |
| `GET /token-usage-statistic/api/export/sessions.csv` | 每行一个会话及其实 provider/model 集合 |
| `GET /token-usage-statistic/api/export.json` | `schemaVersion: 1.0.0`，含用量、预算与账户快照 |

CSV 带 UTF-8 BOM、CRLF、双引号转义，并对以 `= + - @` 开头的文本加前导单引号（防公式注入）。导出只复制允许列表字段，不含提示词、回复、文件路径或凭据。

## 价格口径

内置目录为 DeepSeek 官方 USD 价（每 1M tokens），覆盖 `deepseek-v4-flash` / `deepseek-v4-pro` 的三段历史：平价期、全周峰谷期、工作日峰谷期；峰时段为上海时间 09:00–12:00 与 14:00–18:00。

- 桌面账号路由上报的 `deepseek-flash` / `deepseek-pro` 通过内置别名映射到 `v4` 规则；可用 `modelAliases` 覆盖。
- 只有 `pricing.providers` 内的路由会被计价；第三方网关默认**未定价**。
- 任一样本缺少可靠单价时金额为 `null`，面板显示「—」并提示未定价样本数；token 总数不受影响。

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/token-usage-statistic/api/summary` | 用量、费用、预算、回填状态；`days=1\|7\|30\|all` |
| `GET` | `/token-usage-statistic/api/accounts` | 账户快照；`refresh=1` 触发后台刷新 |
| `GET` | `/token-usage-statistic/api/export/daily.csv` | 按日 provider/model CSV |
| `GET` | `/token-usage-statistic/api/export/sessions.csv` | 会话 CSV |
| `GET` | `/token-usage-statistic/api/export.json` | 版本化 JSON |

所有端点只读、仅回环、`cache-control: no-store`；非回环请求返回 `403`，非 GET/HEAD 返回 `405`。

## 数据与迁移

- 账本：默认 `%DSH_HOME%\token-usage-statistic\usage.jsonl`，一行一个样本。
- `accounts.json`：最近一次账户快照，可删；不会包含凭据。
- `activation.json`：每次激活的路由回执（`registered` / 失败原因），排障用，可删。
- v1 记录（无 `sampleKey`）在加载时自动迁移为 `assistant:<seq>`。
- 清空重来：停用插件 → 删除 `usage.jsonl` → 启用（会重新回填历史）。

## 开发

```powershell
npm install
npm run build       # esbuild → index.js + client.js
npm run typecheck   # tsc --noEmit
npm test            # vitest，120 个用例
npm run test:bundle # 对构建后的 client.js 做假 shell 冒烟
npm run check       # typecheck + build + test + bundle smoke
```

改完 Host 代码后，将插件行 `include:token-usage-statistic` 禁用再启用即可重新导入模块；Client 代码刷新页面即可。

## 排障

- **面板 404**：看 `activation.json`。`route: "failed"` 带原因；文件不存在说明 `webServer` 未注入。
- **账户显示「无公开接口」**：该 provider 没有内置 scheme，用 `accounts.monitors` 配一个通用映射。
- **账户显示「未登录/未配置」**：在 DSH 中登录 DeepSeek 账户，或配置对应 `apiKeyEnv` 后点「刷新账户」。
- **账户查询失败**：显示粗粒度原因（超时、401、限流、响应非法），不会记录或显示密钥。
- **费用/预算为「—」**：存在未定价路由或模型；用 `pricing.providers` / `modelAliases` / `pricing.rules` 扩展。
- **导出 403**：端点只接受回环请求，不要经反向代理暴露到局域网。

## 范围与限制

- 账户只覆盖有公开接口的来源；私有/需登录抓取的额度不做模拟，可由 `accounts.monitors` 自行接入。
- 没有推送通知或后台告警通道：预算状态只在面板与导出中呈现。
- 账本没有轮转/上限；长期使用后文件会增长。
- 面板视觉呈现尚未经过真人验收（槽位注册、接口、构建产物冒烟均已通过）。

## 与参考项目的关系

采样口径、替换语义、价格规则结构、账户 scheme 形态与 fail-closed 费用渲染参考了 [`Ychris12138/dsh-usage-stats`](https://github.com/Ychris12138/dsh-usage-stats)（MIT）。本实现是独立的 TypeScript 代码库，只保留用量/费用/账户/预算/导出这条主线，账户发现与刷新调度自行实现。

## Roadmap

1. 账本轮转与按区间清理。
2. 更多内置订阅 scheme（Qwen Token Plan、Kimi、MiniMax）与官方价格目录。
3. 预算阈值通知（DSH 通知或 webhook）。
4. 月历热图与模型筛选。
5. 面板视觉与交互的细节打磨。

## License

[MIT](LICENSE) © 2026 zhiwuli0228
