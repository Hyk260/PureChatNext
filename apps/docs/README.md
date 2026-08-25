# PureChatNext 文档站

该 workspace 使用 Next.js 16、Fumadocs Core/UI/MDX 构建 <https://next-docs.purechat.cn>，内容直接读取仓库根目录的 `docs/`。`docs/private/` 不会进入内容集合、搜索或站点地图。

## 本地开发

在仓库根目录运行：

```bash
pnpm dev:docs
pnpm lint:docs-site
pnpm typecheck:docs
pnpm test:docs-site
pnpm build:docs
```

开发地址为 <http://localhost:3020>。

开发服务器固定使用 Next.js webpack 模式。文档站需要读取 monorepo 根部的 `docs/` 与 workspace 包；若使用默认 Turbopack，它会将仓库根识别为应用根并误加载主应用的 `src/instrumentation.ts`。

## Vercel 部署

文档站使用独立 Vercel Project：

1. 连接 `Hyk260/PureChatNext`，生产分支选择 `main`。
2. Root Directory 选择 `apps/docs`，Framework Preset 选择 Next.js，Node.js 选择 22。
3. 开启 **Include source files outside of the Root Directory**，让构建读取根目录 `docs/`。
4. 使用仓库中的 `vercel.json` 安装、构建和忽略无关提交。
5. 在 Vercel 项目中绑定 `next-docs.purechat.cn`，并按 Vercel 控制台提示添加 DNS 记录；Preview Deployment 继续使用 Vercel 自动域名。

旧版 VitePress 文档继续使用 `docs.purechat.cn`，不要从旧项目移除该域名。新版站点稳定后，再单独规划旧站迁移和路径级 301。

## Ask AI

Ask AI 只检索仓库中的公开文档，不读取 `docs/private/`，也不保存会话。开发环境读取仓库根目录的 `.env.local`（与主应用共用），不要只写在 `apps/docs/` 下才指望生效：

```bash
AI_GATEWAY_API_KEY=your_ai_gateway_key
```

`apps/docs/.env.local` 仍可单独覆盖同名变量。重启 `pnpm dev:docs` 后生效。

Vercel 生产部署优先使用自动提供的 OIDC；若项目未启用 OIDC，再为独立文档 Project 配置同名密钥。

### Vercel WAF 限流

线上限流由 Vercel Firewall 执行，不在 Serverless 实例内维护内存计数。Project 连接完成后按以下顺序操作，所有规则只匹配 `POST /api/chat`：

1. 新建按 IP 统计的固定窗口规则，先设置为每 600 秒 60 次并使用 `log` 动作。
2. 发布草稿并在 Firewall Traffic 中观察真实请求，确认没有误匹配其他 API。
3. 在 Preview 环境将阈值调整为每 600 秒 20 次，超限动作使用 `rate_limit`（HTTP 429），验证第 21 次请求被拒绝。
4. 确认 Preview 正常后移除 Preview 条件，在 Production 发布 20 次阈值；上线后继续观察 24 小时。

CLI 创建初始草稿的参考命令如下；运行 `vercel firewall diff` 检查后，由项目维护者执行
`vercel firewall publish --yes`：

```bash
vercel firewall rules add "Docs Ask AI" \
  --condition '{"type":"path","op":"eq","value":"/api/chat"}' \
  --condition '{"type":"method","op":"eq","value":"POST"}' \
  --action rate_limit \
  --rate-limit-window 600 \
  --rate-limit-requests 60 \
  --rate-limit-keys ip \
  --rate-limit-action log \
  --yes
```

站点仍不需要数据库、外部搜索、反馈后台或图片 CDN。Firewall 和 DNS 不由仓库脚本自动修改。
