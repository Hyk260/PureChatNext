# PureChatNext 文档站

该 workspace 使用 Next.js 16、Fumadocs Core/UI/MDX 构建 <https://docs.purechat.cn>，内容直接读取仓库根目录的 `docs/`。`docs/private/` 不会进入内容集合、搜索或站点地图。

## 本地开发

在仓库根目录运行：

```bash
pnpm dev:docs
pnpm lint:docs-site
pnpm typecheck:docs
pnpm build:docs
```

开发地址为 <http://localhost:3010>。

## Vercel 部署

文档站使用独立 Vercel Project：

1. 连接 `Hyk260/PureChatNext`，生产分支选择 `main`。
2. Root Directory 选择 `apps/docs`，Framework Preset 选择 Next.js，Node.js 选择 22。
3. 开启 **Include source files outside of the Root Directory**，让构建读取根目录 `docs/`。
4. 使用仓库中的 `vercel.json` 安装、构建和忽略无关提交。
5. 绑定 `docs.purechat.cn`；Preview Deployment 继续使用 Vercel 自动域名。

站点首期不需要环境变量、外部搜索、AI 服务、反馈后台或图片 CDN。
