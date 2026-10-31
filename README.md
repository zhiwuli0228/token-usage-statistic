# token-usage-statistic

一个 DeepSeek Harness（DSH）插件：统计**本机所有模型调用**的 token 用量，并在侧边栏里提供一个按模型、日期、会话汇总的面板。同时适配 DSH Desktop 与 DSH Web —— 两者加载同一份 Web 客户端包和同一套 Host 插件图，因此这个项目只有一份实现。

> 当前版本 `0.1.0`：项目骨架 + 可用的纵向切片（Host 采集 → JSONL 账本 → HTTP 只读接口 → 客户端面板），并带有完整的单元测试。价格/成本、历史回填等能力在[路线图](#路线图)中。

## 它现在能做什么

- 监听 DSH 已提交的 `assistant/message` 会话事件，取其中 provider 上报的 `usage`（输入、输出、缓存读/写、推理、合计）。
- 把每次调用追加写入本机 JSONL 账本，Host 重启或插件热更新后从账本重建全部聚合，不丢历史。
- 按 provider + model、按本地自然日、按会话三个维度聚合，并保留最近若干条调用。
- 在侧边栏注册「模型用量统计」入口，面板支持近 7 天 / 近 30 天 / 全部三个区间，定时刷新。
- 中英文界面文案，跟随 DSH 当前界面语言。

**不包含**（见路线图）：按单价折算成本、站点/网关维度、对插件安装前的历史会话做回填、导出 CSV。

## 架构

```
Session 日志（DSH 的真相来源）
        │  session/event: assistant/message { usage, message.source }
        ▼
┌───────────────────────── Host 半（index.js）─────────────────────────┐
│ Collector   事件 → 规范化记录（provider/model/session/seq/usage）    │
│ UsageStore  内存折叠：总量、按天、按模型、按会话、最近记录            │
│ LedgerWriter 每次调用追加一行 JSONL（$DSH_HOME/token-usage-statistic）│
│ HTTP GET /token-usage-statistic/api/summary  ← 客户端只读            │
└──────────────────────────────────────────────────────────────────────┘
        │ same-origin fetch
        ▼
┌───────────────────────── Client 半（client.js）──────────────────────┐
│ sidebar.panellist  侧边栏图标 + 文案 thunk（跟随语言）                │
│ main (key = token-usage)  仪表盘：指标卡、按模型、按日期、按会话      │
└──────────────────────────────────────────────────────────────────────┘
```

设计要点：

- **账本是唯一可重建的来源**。内存里的 `UsageStore` 是从账本重放出来的派生态；删掉账本等于清空统计，重放账本必定得到同一份聚合。
- **只读取已提交的事件**。用量取自 `assistant/message.usage`，因此统计口径是「模型真正返回并提交的消息」，重试中失败、未提交的请求不会被计费式地重复统计。
- **去重键是 `sessionId#seq`**。同一个会话事件被重放（重启、HMR、将来的历史回填）不会重复累加。
- **同源 HTTP 而不是生成式 Remote**。本仓库是零构建的原生 ESM，没有 typert 代码生成；一条独立路径的只读路由足以支撑面板，也不会遮蔽任何内置路径。该路由必须注册为 `exact`：当前 Web 载体接受 `prefix` 注册但不会派发它。

## 目录

```
index.js                    Host 半入口：apply(ctx, config)
client.js                   Client 半：模块注册 + 侧边栏 + 面板（单文件，无需构建）
src/host/usage.js           纯函数：用量归一化、记录结构、日期键、去重键
src/host/store.js           内存折叠与快照
src/host/ledger.js          JSONL 读写（串行追加、坏行跳过）
src/host/collector.js       会话事件 → 用量记录，header 归属回退
src/host/http.js            只读 HTTP 接口
locale/{en,zh}.json         Plugin Manager / 设置页展示用的标题与描述
icon.svg                    插件图标
cordis.patch.yml            bundle 的 Loader 插入行
test/                       node:test 单元测试（62 个，含客户端冒烟测试）
```

## 安装

本仓库是一个 bundle 包（`package.json` 里的 `dsh.bundle.patch`）。用 Host 的插件管理器按**绝对路径**安装即可，它会完成包安装与 bundle 选择：

```
plugin_manager( action: "install_bundle", target: "E:\\009workspace\\dsh\\token-usage-statistic" )
```

安装后侧边栏会出现「模型用量统计」入口；`GET /token-usage-statistic/api/summary` 也可直接访问。

> 本地目录安装是链接安装（link），修改源码后 Host 重启即可加载新代码。不要手动改 profile 的 `package.json` / `cordis.patch.yml` 来做安装，那些步骤由管理器负责。

## 配置

行配置是可选的，所有字段都有默认值。想改的话，在 profile 的 patch 层用同 id 覆盖这一行：

```yaml
- override:
    - id: token-usage-statistic
      config:
        dataFile: 'D:\\dsh-data\\usage.jsonl'   # 默认 $DSH_HOME/token-usage-statistic/usage.jsonl
        refreshMs: 60000                        # 面板轮询间隔，最小 3000，默认 15000
        sessionLimit: 12                        # 「按会话」最多显示几条，1..100
        recentLimit: 200                        # 内存中保留的最近记录数，0..5000
```

本插件没有声明 `Config` schema（原生 JS、无 schemastery 依赖），因此配置不会被校验；非法值会回退到默认值而不是导致激活失败。

## HTTP 接口

`GET /token-usage-statistic/api/summary`

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `days` | `30` | 近 N 天；`all` 表示全部；最大 3650 |
| `sessions` | `12` | 会话表条数，最大 100 |
| `recent` | `20` | 最近调用条数，最大 100 |

响应要点：

```jsonc
{
  "totals": { "calls": 12, "inputTokens": 34567, "outputTokens": 890, "cacheReadTokens": 12000,
              "cacheWriteTokens": 0, "reasoningTokens": 120, "totalTokens": 35457 },
  "byModel":   [{ "provider": "deepseek", "model": "deepseek-chat", "calls": 12, "totalTokens": 35457, "...": 0 }],
  "byDay":     [{ "day": "2026-10-31", "calls": 12, "totalTokens": 35457, "...": 0 }],
  "sessions":  [{ "sessionId": "session-…", "lastUsedAt": 1788454310462, "calls": 12, "totalTokens": 35457, "...": 0 }],
  "recent":    [{ "time": 1788454310462, "provider": "deepseek", "model": "deepseek-chat", "sessionId": "session-…", "...": 0 }],
  "range":     { "days": 30, "from": "2026-10-02", "to": "2026-10-31" },
  "counts":    { "records": 12, "skipped": 0, "duplicates": 0, "days": 3, "models": 1, "sessions": 2 },
  "config":    { "refreshMs": 15000 }
}
```

接口只读、仅本机、`cache-control: no-store`，不会写入任何东西。

## 数据模型

账本是一行一条 JSON，文件位置见配置。记录字段：

| 字段 | 含义 |
| --- | --- |
| `version` | 记录结构版本，当前 `1` |
| `time` | 事件提交时间（epoch ms） |
| `day` | 本地自然日 `YYYY-MM-DD`（不是 UTC 日） |
| `sessionId` / `seq` | 会话与事件序号，二者构成去重键 |
| `provider` / `model` | 实际路由与模型；缺失时回退到该会话最近一次 `request/header`，再回退 `unknown` |
| `usage.inputTokens` / `outputTokens` | 输入 / 输出 token |
| `usage.cacheReadTokens` / `cacheWriteTokens` | 缓存读 / 写 token |
| `usage.reasoningTokens` | 推理 token |
| `usage.totalTokens` | provider 上报的合计；没有上报时取输入 + 输出 |

口径说明：`cacheReadTokens` 视为输入的一部分，**不**额外加到 `totalTokens`；这是 DeepSeek / OpenAI 风格 usage 的语义。不同 provider 对缓存与推理的记法略有差异，`0.1.0` 先按 provider 原始上报透传，后续可在归一化层按 provider 细分。

## 开发

```powershell
node --test          # 62 个单元测试
node --check index.js; node --check client.js   # 语法检查
```

无构建步骤：Host 半是原生 ESM，Client 半由 `window.__ModuleLoader__` 直接加载，React 来自浏览器的共享模块表（`require('react')`），不安装第二份 React。

本仓库以**链接方式**安装到 profile，因此改完源码后不需要重新打包：用插件管理器把 `include:token-usage-statistic` 这一行禁用再启用，Host 会重新导入模块（已验证），Client 侧通常刷新页面即可。改动 `package.json` 的 `dsh.client` 元数据才需要重装。

## 排障

- **面板显示「统计数据加载失败 · HTTP 404」**：说明 Host 的路由没有注册上。看数据目录里的 `activation.json`：`route: "registered"` 表示路由已注册并记录 `origin`；`route: "failed"` 会带原因。如果文件不存在，说明 `webServer` 服务没有注入成功（该 profile 没有 Web 载体）。
- **面板显示空态**：只统计插件激活后提交的助手消息；发一条消息再点刷新。
- **数据在哪**：默认 `%DSH_HOME%\token-usage-statistic\usage.jsonl`；同目录的 `activation.json` 只是激活回执，可以随时删除。
- **想清空统计**：停用插件，删除 `usage.jsonl`，再启用。

## 已知限制

- 只统计**已提交**的 `assistant/message`。会话标题、压缩摘要等旁路调用如果没有落到会话事件的 `usage` 上，就不会被计入。
- 只有插件激活之后产生的调用会进账本；安装前的历史会话暂时没有回填。
- 账本没有轮转/上限；长期使用后文件会持续增长（读取在激活时一次完成，内存折叠只保留聚合与最近记录）。
- 会话表只显示会话 id，没有标题；标题可以通过 `sessionQuery.readTitle` 补上。
- 面板没有价格表，因此只显示 token，不显示金额。

## 路线图

1. **历史回填**：用 `ctx.sessionQuery.listSessions()` + `readSession()` 重放已有会话日志，按 `sessionId#seq` 去重后补进账本。
2. **价格与成本**：可配置的模型单价表（输入 / 输出 / 缓存命中 / 缓存写入），面板展示金额与「官方直连 vs 网关」维度。
3. **按会话钻取**：点击会话行展开按模型/按天的明细；会话标题与 cwd。
4. **导出**：CSV / JSON 导出，以及按区间清理账本。
5. **更细的归属**：`purpose`（compaction / session-title）、站点（baseURL）、推理档位。
6. **账本轮转**：按大小切分历史文件，保持激活时的重放时间可控。

## License

尚未选择许可证；在发布或分发前请补上 `LICENSE`。
