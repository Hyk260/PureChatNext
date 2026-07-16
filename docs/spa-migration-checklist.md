# PureChatNext → SPA + Next API 改造清单

> 目标：**UI 走 Vite SPA（react-router），Next 只保留 API / auth / SPA HTML 壳**；生产仍同域部署（Vercel）。  
> 第一期不做多端（desktop / mobile / popup）。  
> 状态：规划文档，按勾选推进。

---

## 0. 原则与范围

- [ ] **API 层第一期零迁移**：`src/app/api/**` 保持 Next Route Handler
- [ ] **业务 UI 不重写**：`src/features/**` 尽量只换路由 / 导航 API
- [ ] **不做 LobeHub 全套**：暂不做 Debug Proxy、多入口、i18n variants
- [ ] **验收标准**：本地 `dev:next` + `dev:spa` 可登录、聊天流式、设置页可进；生产 `build` 同域可访问

---

## 1. 基建（第 1 周前半）

### 1.1 依赖与脚本

- [x] 确认已有 `react-router`（已在 deps）；补 Vite、`@vitejs/plugin-react`、开发代理相关依赖
- [x] `package.json` 增加脚本（命名可自定）：
  - [x] `dev:next` → 现有 Next
  - [x] `dev:spa` → Vite
  - [x] `dev` → 并发起 Next + SPA（或文档写清两个终端）
  - [x] `build:spa` / `build:spa:copy` / `build:next` / `build`（先 SPA 再 Next）
- [x] 更新 `AGENTS.md`：从「非 SPA」改为「SPA + Next BFF」约定

### 1.2 Vite 与入口

- [x] 新增 `vite.config.ts`（alias `@`、端口如 `5174`、proxy `/api` 等到本机 Next 端口）
- [x] 新增根 `index.html`（可先无 `__SERVER_CONFIG__`）
- [x] 新增 `src/spa/entry.web.tsx`（挂载 RouterProvider / BrowserRouter）
- [x] 新增 `src/spa/AppLayer.tsx`（Theme / Auth / Query 等全局 Provider，从现有 `layout` 抽）

### 1.3 路由骨架

- [x] 新增 `src/spa/router/webRouter.config.tsx`（或 `src/routes` 薄层 + features）
- [x] 把现有 App Router 树映射为 react-router 配置（见下节路由表）
- [x] Layout 组件从 `src/app/**/layout.tsx` 抽到 `src/layout` / `src/features/*/Shell`，供 SPA 复用
  - 薄层：`src/routes/**/_layout.tsx` + `page.tsx`；Shell：`MainShellLayout` / `SettingsShellLayout` / `CommunityShellLayout` / `ResourcesShellLayout` / `ProviderShellLayout`
  - 辅助：`src/utils/router.tsx`（`dynamicElement` / `dynamicLayout` / `createAppRouter`）；Vite shim：`src/spa/shims/next-*`

### 1.4 Next 侧 SPA 壳（生产用，可第二周再做）

- [x] 新增 SPA HTML 服务路由（参考 LobeHub `src/app/spa/...`）：注入必要 config 后返回 `index.html` 模板
  - 路由：`src/app/spa/[[...path]]/route.ts`；注入：`window.__SERVER_CONFIG__`（`src/server/spaHtml`）
- [x] `build:spa` 产物拷到 `public/_spa`（或等价目录）
  - `scripts/copySpaBuild.mts`：assets → `public/_spa/`；HTML → `src/app/spa/spaHtmlTemplate.generated.ts`
  - Vite 生产 `base: '/_spa/'`
- [x] 页面路由 fallback：非 `/api/*` 的前端路径落到 SPA shell
  - `next.config.ts` `rewrites.fallback` → `/spa/:path*`（有对应 Next page 时仍优先 page；迁移删 page 后走壳）
  - `/_spa/**` 长缓存；SPA HTML `Cache-Control: no-cache`
- [x] 本地开发：直接访问 `http://localhost:5174`，**不要**依赖线上 Debug Proxy

---

## 2. 路由迁移表（按模块勾选）

> 现有 43 个 `page.tsx` → SPA route；Next `page.tsx` 最终可删或改成 redirect 到 SPA shell。  
> SPA 树：`src/spa/router/webRouter.config.tsx` + `src/routes/**` 薄层 → features / `app`（经 Vite shim）。

### 2.1 核心业务（优先）

| 原路径 | SPA 路由 | Feature 入口 | 状态 |
|--------|----------|-------------|------|
| `/(main)` | `/` | `features/home/HomePage` | [x] |
| `/chat` | `/chat` | `features/chat/ChatPage` | [x]（`RequireAuth` gate，见 §4） |
| `/resources/(home)` | `/resources` | ResourceHome | [x] |
| `/resources/library/[id]` | `/resources/library/:id` | ResourceLibrary | [x] |
| `/resources/library/[id]/[...slug]` | `/resources/library/:id/*` | ResourceLibrary | [x] |

### 2.2 Auth / 账号

| 原路径 | SPA 路由 | 备注 | 状态 |
|--------|----------|------|------|
| `/signin` | `/signin` | 薄层 re-export `app/signin`；迁 `features/auth` → §9 | [x] |
| `/signup` | `/signup` | 同上 | [x] |
| `/login` | `/login` | 保留 legacy（旧 JWT 表单）；主流程用 `/signin` | [x] |
| `/verify-email` | `/verify-email` | | [x] |
| `/reset-password` | `/reset-password` | | [x] |
| `/auth-error` | `/auth-error` | | [x] |
| `/welcome` | `/welcome` | | [x] |
| `/profile` | `/profile` | → `/settings/profile` | [x] |
| `/protected` | `/protected` | 客户端 `me()` gate | [x] |

### 2.3 Settings（多数空壳，可批量迁）

| 原路径 | 状态 |
|--------|------|
| `/settings` | [x] → `/settings/profile` |
| `/settings/profile` | [x] 客户端拉取 `GET /api/webapi/user/profile` → `ProfileSettingsContent` |
| `/settings/provider`、`/all`、`/[id]` | [x] |
| `/settings/appearance` `/language` `/hotkey` `/notification` `/stats` | [x]（空壳，与 Next 对等） |
| `/settings/advanced` `/storage` `/memory` `/creds` `/about` | [x]（空壳，与 Next 对等） |
| `/settings/messenger` `/connector` `/skill` `/service-model` | [x]（空壳，与 Next 对等） |

### 2.4 Community

| 原路径 | 状态 |
|--------|------|
| `/community` | [x] → `/community/provider` |
| `/community/agent` `/model` `/provider` | [x] |

### 2.5 Dev（可后置）

| 原路径 | 状态 |
|--------|------|
| `/dev/*`（web-search、email、s3、read-file、delete-user…） | [x] 仅 `import.meta.env.DEV` 注册；生产构建不进路由表（仍 404） |

---

## 3. Navigation / URL 适配（约 40+ 文件）

### 3.1 `next/navigation` → `react-router`

按目录扫并替换（当前命中示例）：

- [x] `src/features/chat/ChatPage.tsx`
- [x] `src/features/home/**`（Sidebar、HomeChatInput…）
- [x] `src/features/settings/**`（Shell、Sidebar、provider nav…）
- [x] `src/features/community/**`
- [x] `src/features/resources/**`（Explorer、Sidebar、pages、hooks；splat `*` ↔ slug）
- [x] `src/layout/**`（`SideBarHeaderLayout`；`AppThemeProvider` 仍用 Next `useServerInsertedHTML`）
- [x] `src/app/signin|signup|verify-email|reset-password|auth-error|login|profile|welcome/**`（hooks/表单）

> 客户端统一走 `@/utils/navigation` / `@/utils/link`（re-export `next/*`）。  
> Vite 将 `next/navigation|link` alias 到 `src/spa/shims/*`（react-router），故 **Next 与 SPA 双运行时** 共用同一套 import。  
> 仍直接写 `next/navigation` 的仅限：Next 服务端 `redirect` / `notFound` page，以及 `AppThemeProvider`（`useServerInsertedHTML`）。  
> SPA 专用：`Navigate` 等从 `react-router` 引入（见 `SettingsProfilePage`）。

替换对照：

| Next | 薄层 / SPA |
|------|----------------|
| `useRouter().push` | `@/utils/navigation` → Vite shim → `useNavigate()` |
| `usePathname` | `@/utils/navigation` |
| `useSearchParams` | `@/utils/navigation`（shim 已 unwrap RR tuple） |
| `redirect()`（server） | 客户端 SPA：`<Navigate>`；Next page 暂留至 §9 |
| `useParams` | `@/utils/navigation`（Resources splat 见 `useFolderPath`） |
| `next/link` `href` | `@/utils/link` → shim → RR `to` |

- [x] 统一封装薄层：`src/utils/navigation.ts` + `src/utils/link.tsx`（`src/utils/router.tsx` 仍负责 route factory）

### 3.2 `nuqs`

- [x] SPA：`AppLayer` 使用 `nuqs/adapters/react-router/v8`；Next `AppShellLayout` 暂留 `nuqs/adapters/next/app`（至 §9 删 layout）
- [ ] Resources 相关 URL state 全量回归（手工冒烟，见 §8.2）

### 3.3 链接组件

- [x] `next/link` → `@/utils/link`（`href` API → react-router `to`；全局客户端已扫）

---

## 4. Auth 适配（关键路径）

- [x] **保留** `src/app/api/auth/[...all]/route.ts`（better-auth）
- [x] 客户端 session：统一 `useSession` / better-auth client；SPA 用 `RequireAuth`，去掉对 `headers()` page 门禁的依赖（Next SSR 页仍可暂留至 §9）
- [x] 改造原 SSR 页：
  - [x] `src/app/chat/page.tsx`（session + redirect）→ SPA：`src/routes/chat/_layout.tsx` + `RequireAuth`
  - [x] `src/app/settings/profile/page.tsx`（DB 预取）→ 进页后 fetch（`SettingsProfilePage` + `GET /api/webapi/user/profile`；Next SSR 页仍保留至 §9）
  - [x] `src/app/settings/provider/[id]/page.tsx`（校验）→ SPA 客户端校验（`src/routes/settings/provider/[id]/page.tsx`）
- [x] OAuth / 邮件回调 URL：仍指向 **同源** `/api/auth/...`（`APP_URL` + better-auth；本地 SPA `5174` 经 Vite proxy `/api`；OAuth 完成后落地 `APP_URL`，生产同域无感）
- [x] 开发 CORS：Vite origin 加入 `allowed-origins`（`localhost:5174`）；API `credentials: 'include'`
- [x] 处理 `src/proxy.ts`：Next.js 16 已用 **Proxy** 替代 Middleware —— **保留** `proxy.ts`（CORS + `/api/rest-api` JWT）；勿改回 `middleware.ts`
- [x] 登录后 `callbackUrl`：`resolveCallbackUrl` 防开放重定向；邮箱密码成功后 `router.push`（SPA 内跳转）

---

## 5. 数据与 API（尽量不动）

- [x] 确认前端请求一律相对路径：`/api/...`（禁止写死 `localhost:3000`；业务客户端已扫，无硬编码 host）
- [x] 抽查关键 API 在 SPA 下可用（经 Vite `5174` → Next proxy；未登录期望 401/400，非 404/502）：
  - [x] `/api/chat` 流式（`DefaultChatTransport` `api: '/api/chat'` + `credentials: 'include'`；空 POST → 400）
  - [x] `/api/chat/topics/*`（`chatApi` → `apiFetch`；未登录 401）
  - [x] `/api/agents*`（`agentApi` → `apiFetch`；未登录 401）
  - [x] `/api/resources/*`（含 `files/.../content`；`resourceService` → `apiFetch`；未登录 401）
  - [x] `/api/auth/*`、`/api/user/*`、`/api/webapi/user/profile`（config 200；stats/profile 未登录 401）
- [x] SWR / 自研 fetch：`API_BASE_URL = ''`；统一薄层 `src/utils/apiFetch.ts`（相对路径 + cookie）
- [x] `@ai-sdk/react` `useChat` 的 transport `api` 仍指向 `/api/chat`（已去掉误留 `debugger`）

---

## 6. Layout / 全局能力搬迁

从根 `layout.tsx` / 各段 layout 迁到 SPA：

- [x] Theme（SPA：`ThemeProviders` via `AppLayer`；Next 仍用 `AppThemeProvider` SSR 样式注入）
- [x] 全局 CSS / Tailwind（`entry.web.tsx` 与 Next root layout 同导入）
- [x] Analytics（`SpaTelemetry`：`@vercel/analytics/react` + react-router `path`/`route`；开关经 `__SERVER_CONFIG__`）
- [x] Speed Insights（`@vercel/speed-insights/react`，同挂 `AppLayer`；生产 `IS_VERCEL` 注入）
- [x] 各 Shell：`MainShell` / Chat（`RequireAuth` + 页内 `ChatLayout`）/ `SettingsShell` / Community / Resources
- [x] 根 `metadata`：`index.html` / SPA shell 静态 `title` + `description`（聊天站 SEO 要求低）

---

## 7. 构建与部署

- [ ] 本地：`pnpm dev:next` + `pnpm dev:spa` 文档写清访问 `http://localhost:<spa-port>`
- [ ] `build`：`build:spa` → copy → `next build`
- [ ] Vercel：仍单项目；确认 install/build command；环境变量不变
- [ ] 缓存：`/_spa/**` 可加长缓存（参考 LobeHub `vercel.json` headers，可选）
- [x] 回滚方案：保留一版「纯 Next `dev`/`build`」分支或 flag，直到 SPA 稳定

---

## 8. 测试与验收清单

### 8.1 冒烟（每迁完一个模块勾）

- [ ] 未登录访问 `/chat` → 进登录
- [ ] 邮箱/密码注册登录
- [ ] GitHub（或已接的）OAuth 往返
- [ ] 首页建会话 → 进入 `/chat` 流式回复
- [ ] Topic 切换 / 新建
- [ ] Settings profile 读写
- [ ] Provider 列表与 `[id]` 页
- [ ] Resources：列表、进库、上传、预览
- [ ] Community 列表点击跳转
- [ ] 刷新深链（如 `/settings/appearance`、`/resources/library/:id/...`）不 404

### 8.2 回归重点（易出问题）

- [ ] Cookie session 在 SPA 端口下是否带上
- [ ] 流式中断 / 取消
- [ ] Resources + `nuqs` URL 同步
- [ ] 生产直开子路径（需 SPA fallback）
- [ ] Dev 页生产 404

### 8.3 测试代码

- [ ] 涉及 `next/navigation` mock 的测试改为 react-router
- [ ] 关键路由 smoke test（可选）

---

## 9. 清理（稳定后）

- [ ] 删除或掏空已迁走的 `src/app/**/page.tsx`（auth API、spa shell 除外）
- [ ] 删除无用 `layout.tsx`（保留 root / spa shell）
- [ ] 搜残留：`next/link`、`next/navigation`、`nuqs/adapters/next`
- [ ] 文档：README 本地开发、部署说明
- [ ] 可选：auth 相关组件从 `src/app/signin` 等挪到 `src/features/auth`

---

## 10. 建议排期

| 周次 | 交付 | 清单章节 |
|------|------|----------|
| W1 | 基建 + Home + Auth 闭环 | §1、§2.1 首页、§2.2、§4、§8 登录相关 |
| W2 | Chat + Settings/Community | §2.1 chat、§2.3、§2.4、§3、§8 聊天 |
| W3 | Resources + 生产 build/fallback | §2.1 resources、§7、§8 全量、§9 |

**粗估**：单人约 2–3 周（含基本验证）；若对齐 LobeHub 级基建再加约 1 周。

---

## 11. 明确不做（第一期）

- [x] 不拆独立前端仓库 / 独立域名
- [x] 不迁 `/api` 到别的服务
- [x] 不上 tRPC 改造
- [x] 不做 Electron / mobile 多入口
- [x] 不接 LobeHub Debug Proxy（`app.lobehub.com`）

---

## 参考

- LobeHub SPA 入口：`src/spa/entry.web.tsx`
- LobeHub SPA HTML 壳：`src/app/spa/[variants]/[[...path]]/route.ts`
- LobeHub 本地脚本：`dev` / `dev:spa` / `build:spa` → `build:next`
- 本仓库现状：App Router + 薄 `page.tsx` + `features/` + better-auth + 约 39 个 API route
