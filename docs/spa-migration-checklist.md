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

- [ ] 新增 `src/spa/router/webRouter.config.tsx`（或 `src/routes` 薄层 + features）
- [ ] 把现有 App Router 树映射为 react-router 配置（见下节路由表）
- [ ] Layout 组件从 `src/app/**/layout.tsx` 抽到 `src/layout` / `src/features/*/Shell`，供 SPA 复用

### 1.4 Next 侧 SPA 壳（生产用，可第二周再做）

- [ ] 新增 SPA HTML 服务路由（参考 LobeHub `src/app/spa/...`）：注入必要 config 后返回 `index.html` 模板
- [ ] `build:spa` 产物拷到 `public/_spa`（或等价目录）
- [ ] 页面路由 fallback：非 `/api/*` 的前端路径落到 SPA shell
- [ ] 本地开发：直接访问 `http://localhost:5174`，**不要**依赖线上 Debug Proxy

---

## 2. 路由迁移表（按模块勾选）

> 现有 43 个 `page.tsx` → SPA route；Next `page.tsx` 最终可删或改成 redirect 到 SPA shell。

### 2.1 核心业务（优先）

| 原路径 | SPA 路由 | Feature 入口 | 状态 |
|--------|----------|-------------|------|
| `/(main)` | `/` | `features/home/HomePage` | [ ] |
| `/chat` | `/chat` | `features/chat/ChatPage` | [ ] |
| `/resources/(home)` | `/resources` | ResourceHome | [ ] |
| `/resources/library/[id]` | `/resources/library/:id` | ResourceLibrary | [ ] |
| `/resources/library/[id]/[...slug]` | `/resources/library/:id/*` | ResourceLibrary | [ ] |

### 2.2 Auth / 账号

| 原路径 | SPA 路由 | 备注 | 状态 |
|--------|----------|------|------|
| `/signin` | `/signin` | hooks 在 `app/signin`，建议迁到 `features/auth` | [ ] |
| `/signup` | `/signup` | 同上 | [ ] |
| `/login` | `/login` | 与 signin 是否合并，决策后勾选 | [ ] |
| `/verify-email` | `/verify-email` | | [ ] |
| `/reset-password` | `/reset-password` | | [ ] |
| `/auth-error` | `/auth-error` | | [ ] |
| `/welcome` | `/welcome` | | [ ] |
| `/profile` | `/profile` | | [ ] |
| `/protected` | `/protected` | 或改纯客户端 gate | [ ] |

### 2.3 Settings（多数空壳，可批量迁）

| 原路径 | 状态 |
|--------|------|
| `/settings` | [ ] |
| `/settings/profile` | [ ] （原有 SSR 预取，需改客户端） |
| `/settings/provider`、`/all`、`/[id]` | [ ] |
| `/settings/appearance` `/language` `/hotkey` `/notification` `/stats` | [ ] |
| `/settings/advanced` `/storage` `/memory` `/creds` `/about` | [ ] |
| `/settings/messenger` `/connector` `/skill` `/service-model` | [ ] |

### 2.4 Community

| 原路径 | 状态 |
|--------|------|
| `/community` | [ ] |
| `/community/agent` `/model` `/provider` | [ ] |

### 2.5 Dev（可后置）

| 原路径 | 状态 |
|--------|------|
| `/dev/*`（web-search、email、s3、read-file、delete-user…） | [ ] 生产仍 404 |

---

## 3. Navigation / URL 适配（约 40+ 文件）

### 3.1 `next/navigation` → `react-router`

按目录扫并替换（当前命中示例）：

- [ ] `src/features/chat/ChatPage.tsx`
- [ ] `src/features/home/**`（Sidebar、HomeChatInput…）
- [ ] `src/features/settings/**`（Shell、Sidebar、provider nav…）
- [ ] `src/features/community/**`
- [ ] `src/features/resources/**`（Explorer、Sidebar、pages、hooks）
- [ ] `src/layout/**`（`AppShellLayout`、`SideBarHeaderLayout`、`AppThemeProvider`）
- [ ] `src/app/signin|signup|verify-email|reset-password|auth-error|login|profile|welcome/**`（hooks/表单）

替换对照：

| Next | React Router |
|------|----------------|
| `useRouter().push` | `useNavigate()` |
| `usePathname` | `useLocation().pathname` |
| `useSearchParams` | `useSearchParams`（react-router） |
| `redirect()`（server） | 客户端 `<Navigate>` / `navigate()` |
| `useParams` | `useParams` |

- [ ] 统一封装薄层 `src/utils/router.ts`（可选，降低扩散）

### 3.2 `nuqs`

- [ ] `AppShellLayout` 等处的 `nuqs/adapters/next/app` → `nuqs/adapters/react-router`（按 nuqs 文档选对应 adapter）
- [ ] Resources 相关 URL state 全量回归

### 3.3 链接组件

- [ ] `next/link` → `react-router` 的 `Link`（全局搜一遍勾选）

---

## 4. Auth 适配（关键路径）

- [ ] **保留** `src/app/api/auth/[...all]/route.ts`（better-auth）
- [ ] 客户端 session：统一 `useSession` / better-auth client，去掉依赖 `headers()` 的 page 门禁
- [ ] 改造原 SSR 页：
  - [ ] `src/app/chat/page.tsx`（session + redirect）→ SPA loader/guard
  - [ ] `src/app/settings/profile/page.tsx`（DB 预取）→ 进页后 fetch
  - [ ] `src/app/settings/provider/[id]/page.tsx`（校验）→ 客户端校验
- [ ] OAuth / 邮件回调 URL：确认仍指向 **同源** `/api/auth/...`（生产不变；本地注意端口）
- [ ] 开发 CORS：Vite origin 加入 `allowed-origins`；API `credentials: 'include'`
- [ ] 处理 `src/proxy.ts`：恢复为 `middleware.ts` 或并入 API 层（CORS + `/api/rest-api` JWT）
- [ ] 登录后 `callbackUrl` 在 SPA 内跳转，不依赖 Next `redirect`

---

## 5. 数据与 API（尽量不动）

- [ ] 确认前端请求一律相对路径：`/api/...`（禁止写死 `localhost:3000`）
- [ ] 抽查关键 API 在 SPA 下可用：
  - [ ] `/api/chat` 流式
  - [ ] `/api/chat/topics/*`
  - [ ] `/api/agents*`
  - [ ] `/api/resources/*`（含文件 content）
  - [ ] `/api/auth/*`、`/api/user/*`
- [ ] SWR / 自研 fetch 的 baseURL 行为确认
- [ ] `@ai-sdk/react` `useChat` 的 `api` 路径仍指向 `/api/chat`

---

## 6. Layout / 全局能力搬迁

从根 `layout.tsx` / 各段 layout 迁到 SPA：

- [ ] Theme（antd / antd-style / `AppThemeProvider`）
- [ ] 全局 CSS / Tailwind
- [ ] Analytics（`@vercel/analytics`：注意 SPA 下 pageview，可能要挂 router 监听）
- [ ] Speed Insights
- [ ] 各 Shell：`MainShell` / Chat layout / `SettingsShell` / Community / Resources
- [ ] 根 `metadata`：生产由 SPA shell 或 Next 壳页提供静态 title（聊天站 SEO 要求低）

---

## 7. 构建与部署

- [ ] 本地：`pnpm dev:next` + `pnpm dev:spa` 文档写清访问 `http://localhost:<spa-port>`
- [ ] `build`：`build:spa` → copy → `next build`
- [ ] Vercel：仍单项目；确认 install/build command；环境变量不变
- [ ] 缓存：`/_spa/**` 可加长缓存（参考 LobeHub `vercel.json` headers，可选）
- [ ] 回滚方案：保留一版「纯 Next `dev`/`build`」分支或 flag，直到 SPA 稳定

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
