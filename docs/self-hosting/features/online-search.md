---
title: 配置 PureChatNext 联网搜索
description: 在 PureChatNext 配置联网搜索 Provider 与 API Key，使用管理页验证搜索回退，并单独设置网页抓取实现。
---

# 配置 PureChatNext 联网搜索

本文说明如何给 PureChatNext 配置实时搜索来源，以及如何单独配置网页抓取。`SEARCH_PROVIDERS` 按顺序尝试搜索服务并在无结果时回退；`CRAWLER_IMPLS` 控制读取网页正文的抓取实现，两者解决不同问题。配置项已于 2026-10-16 对照当前源码核对。

## 先区分搜索与网页抓取

- **搜索**：输入关键词，返回网页标题、链接和摘要。配置 `SEARCH_PROVIDERS` 及相应服务凭证。
- **网页抓取**：已知 URL 后提取网页正文，供阅读或后续处理。配置 `CRAWLER_IMPLS` 及抓取服务凭证。
- PureChatNext 不会把多个搜索 Provider 的结果合并。`SEARCH_PROVIDERS` 中前面的服务先运行；若无结果，再尝试后续服务。某个 Provider 报错或没有结果时，请检查后端日志与回退结果。

使用第三方搜索或抓取 API 可能产生费用、配额或速率限制；请在选用前查看服务商当前套餐。自托管 SearXNG 可不使用第三方搜索 API Key，但需自行维护服务器、搜索引擎可达性与 JSON 接口。

## 快速配置：SearXNG 搜索 + Fetch

本地开发可使用仓库 Docker 开发依赖自带的 SearXNG。运行 `pnpm dev:docker` 后，在 Next 应用读取的环境文件中配置：

```dotenv
SEARCH_PROVIDERS=searxng
SEARXNG_URL=http://localhost:8180
CRAWLER_IMPLS=naive
```

`localhost` 必须从运行 Next 的环境可达；如果应用本身也在容器内，请将 URL 改成应用容器能访问的 SearXNG 服务地址。SearXNG 必须启用 `json` 输出。生产部署中，设置 `SEARXNG_URL` 为应用服务器可访问的地址，或选择下表中的 API Provider。

配置或新增密钥后重启 Next / 重新部署。不要把真实 API Key 提交到 Git，也不要将密钥粘贴进公开诊断截图。

## 个人网络搜索设置

登录后打开 `/settings/web-search`（设置 → 工具 → 网络搜索）。配置按账号同步，Web、桌面及绑定账号的 QQ / 微信聊天共用；设置变更在下一次请求生效。

- 搜索和 URL 获取分别选择服务商，范围限于下表中已支持的实现。选择“跟随服务器配置”继续使用环境变量中的服务顺序。
- 每个字段依次使用用户配置、对应环境变量、产品默认值。用户选择服务商后，调用失败不切换到服务器的其他服务商；清空用户字段可恢复继承。
- 可配置 API 地址、密钥列表及必要附加字段。多个用户密钥按请求轮询；同一服务商的搜索与 URL 获取共享用户密钥，地址分别保存。自定义地址不能借用服务器密钥，需填写用户自己的密钥。
- 用户密钥及 Basic Auth 密码使用现有 `KEY_VAULTS_SECRET` 加密落库。服务器环境密钥不会返回到浏览器；仅向本人返回其填写的密钥。未配置金库密钥时无法保存用户凭证。
- 高级设置默认最多 5 条结果、截断正文、整批 2000 tokens；支持 1–100 条的结果上限，实际数量受服务商限制。“不压缩”保留服务返回正文。
- 黑名单每行一条，支持 `*://*.example.com/*` 和 `/example\.(net|org)/`，作用于搜索结果与网页读取。无效规则不会保存。
- “优先使用模型内置 Web 工具”默认开启，当前仅接入已验证的 OpenAI 官方 Responses 模型（GPT-5.6 Sol / Luna / Terra、GPT-5.5、GPT-5.4）。其他模型和自定义兼容端点使用外部服务商；`OPENAI_BASE_URL` 指向非官方地址时也使用外部工具。有黑名单或桌面逐次审批要求时使用外部工具，保证过滤和审批生效。结果个数及正文截断仅作用于外部工具。

服务商表单失焦保存，选择与开关即时保存，黑名单需点击保存。检测按钮会先保存当前表单，再分别执行真实搜索或网页读取并显示耗时。恢复服务器配置会清除该账号的搜索设置与用户凭证。

## 验证搜索和抓取

管理员登录后打开 `/settings/web-search-console`（设置 → 管理 → 联网搜索测试台）。该诊断页面使用管理接口，可分别检查联网搜索、Provider 回退和网页抓取：

1. **Web Search**：输入关键词，留空 Provider 时使用 `SEARCH_PROVIDERS` 顺序执行；也可指定单个 Provider。检查结果数量及实际返回的 Provider；若过滤条件没有结果，界面会显示回退层级。
2. **Crawl Pages**：输入一条可公开访问的页面 URL。返回正文且结果中有 crawler 名称，说明抓取服务可用；搜索正常但抓取失败时，单独检查抓取配置。
3. 最后在启用了联网搜索能力的 Agent 对话中提出一个需要新资料的问题，确认聊天工具链也能调用搜索。

页面测试结果会显示请求状态码与耗时。失败时先看响应错误，再按下表排查；`/api/health` 的 `checks.search` 只检查已配置 SearXNG 的进程连通性；其他 Provider、关键词结果和网页正文仍需在管理页单独验证。

## 搜索 Provider：`SEARCH_PROVIDERS`

用英文逗号分隔 Provider；建议先只配置一个服务完成验证，再按需增加回退项。省略或留空时默认使用 SearXNG，因此仍须配置 `SEARXNG_URL`。

```dotenv
SEARCH_PROVIDERS=searxng,brave
SEARXNG_URL=https://search.example.com
BRAVE_API_KEY=replace-with-your-key
```

| 值 | API 凭证 / 配置 | 说明 |
| --- | --- | --- |
| `anspire` | `ANSPIRE_API_KEY` | Anspire 搜索 API。 |
| `bocha` | `BOCHA_API_KEY` | 博查搜索 API。 |
| `brave` | `BRAVE_API_KEY` | Brave Search API。 |
| `exa` | `EXA_API_KEY` | Exa 搜索 API。 |
| `firecrawl` | `FIRECRAWL_API_KEY` | Firecrawl Search API。 |
| `google` | `GOOGLE_PSE_API_KEY`、`GOOGLE_PSE_ENGINE_ID` | Google Programmable Search Engine；两项都要配置。 |
| `jina` | `JINA_READER_API_KEY`（也兼容 `JINA_API_KEY`） | Jina Search；`JINA_USE_CN_DOMAINS` 默认 `true`，设为 `false` 使用默认域名。 |
| `kagi` | `KAGI_API_KEY` | Kagi Search API。 |
| `search1api` | `SEARCH1API_SEARCH_API_KEY` 或 `SEARCH1API_API_KEY` | Search1API Search；通用 Key 也可供抓取实现使用。 |
| `searxng` | `SEARXNG_URL` | 自托管或可访问的 SearXNG 实例，必须开启 JSON 格式。 |
| `tavily` | `TAVILY_API_KEY` | Tavily Search API。 |

Tavily 搜索还可设置 `TAVILY_SEARCH_DEPTH=basic` 或 `advanced`。搜索分类、引擎和时间范围是否受支持取决于 Provider；部分服务会忽略不支持的过滤条件。

## 网页抓取实现：`CRAWLER_IMPLS`

配置顺序决定默认抓取尝试顺序。未设置时，内置默认序列为 `jina,naive,search1api,browserless`；设置后，应用按指定列表和 URL 规则选择实现。可用逗号分隔多个值：

```dotenv
CRAWLER_IMPLS=naive,jina,firecrawl
CRAWL_CONCURRENCY=3
CRAWLER_RETRY=1
```

| 值 | 凭证 / 环境变量 | 说明 |
| --- | --- | --- |
| `naive` | 无 | Fetch：由应用服务器直接请求目标网页并提取正文，不调用第三方抓取 API。 |
| `jina` | `JINA_READER_API_KEY`（也兼容 `JINA_API_KEY`） | 通过 Jina Reader 提取网页内容。 |
| `browserless` | `BROWSERLESS_TOKEN` 或 `BROWSERLESS_URL` | 使用 Browserless 浏览器服务；自定义地址时设置 `BROWSERLESS_URL`。 |
| `search1api` | `SEARCH1API_CRAWL_API_KEY` 或 `SEARCH1API_API_KEY` | Search1API 网页抓取；也可另设 `SEARCH1API_SEARCH_API_KEY` 供搜索使用。 |
| `firecrawl` | `FIRECRAWL_API_KEY` | Firecrawl 抓取；自托管时可用 `FIRECRAWL_URL` 覆盖 API 地址，默认 `https://api.firecrawl.dev/v2`。 |
| `exa` | `EXA_API_KEY` | Exa 网页内容读取。 |
| `tavily` | `TAVILY_API_KEY` | Tavily 网页内容提取。 |

`CRAWL_CONCURRENCY` 范围为 1–10，默认 3；`CRAWLER_RETRY` 范围为 0–3，默认 1，表示失败后最多额外重试一次。Browserless 的 `BROWSERLESS_BLOCK_ADS=1` 可开启资源过滤；`BROWSERLESS_STEALTH_MODE=1` 控制 Browserless stealth 选项，默认关闭。Jina 默认使用国内域名；设置 `JINA_USE_CN_DOMAINS=false` 可改用默认域名。

## 常见故障

| 现象 | 常见原因 | 处理方式 |
| --- | --- | --- |
| 搜索提示未配置 SearXNG | `SEARCH_PROVIDERS` 留空，应用默认选了 SearXNG，但 `SEARXNG_URL` 为空 | 配置可访问的 `SEARXNG_URL`，或明确设置其他 Provider 及其 Key；重启 Next。 |
| SearXNG 返回格式错误 / HTTP 4xx | 实例未启用 JSON 输出，或应用容器访问不到地址 | 在 SearXNG `settings.yml` 的 `search.formats` 中启用 `json`；从 Next 运行环境验证 URL、DNS 和网络策略。 |
| Provider 返回空结果 | Key、配额、服务商限制或查询过滤条件有误 | 在管理页选择该 Provider 做 Web Search；先移除分类 / 引擎 / 时间范围过滤，再检查服务商错误详情。 |
| Provider 回退没有发生 | `SEARCH_PROVIDERS` 只有一个值，或前置 Provider 已返回结果 | 用逗号配置第二个 Provider；该链路遇到第一家有结果即停止，不会合并所有来源。 |
| 搜索有结果但网页没有正文 | `CRAWLER_IMPLS` 未包含可用实现、抓取 Key 无效或目标站不可访问 | 用 Crawl Pages 单独验证公开 URL，检查返回的 crawler 与错误信息，再核对对应 Key 和容器网络。 |
| 改了 Key 后仍使用旧配置 | Next 进程尚未重启，或密钥改在错误的部署环境 | 在应用实际读取的环境中更新变量并重启 / 重新部署；检查运行日志，不要打印 Key。 |

本地开发启动 SearXNG、PostgreSQL 与 Redis 的步骤见 [Docker 自托管](../platform/docker.md)。环境文件与主备站配置见[环境变量指南](../configuration/environment.md)。

## 继续了解

- [Docker 自托管](../platform/docker.md) · [环境变量配置](../configuration/environment.md) · [联网搜索开发说明](../../development/README.md)
- [体验 PureChat](https://app.purechat.cn/?utm_source=docs&utm_medium=organic&utm_campaign=self_hosting_guide&utm_content=online_search) · [GitHub 源码](https://github.com/Hyk260/PureChatNext)

## 参考资料

- [SearXNG 官方文档](https://docs.searxng.org/)
- [SearXNG GitHub 仓库](https://github.com/searxng/searxng)
