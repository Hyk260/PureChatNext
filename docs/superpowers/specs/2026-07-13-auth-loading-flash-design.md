# Auth 页面切换 Loading 闪烁修复

日期：2026-07-13  
状态：已批准设计，待实现

## 问题

在 `/signup` ↔ `/signin` 之间客户端切换时，整页品牌 Loading（`BrandTextLoading`）会反复闪烁。用户期望：仅首次进入 auth 相关页可以 Loading，之后来回切换不应再闪。

Next.js 路由缓存无法消除该现象，因为闪烁来自客户端 remount 时的两层本地状态，而非缺少 RSC 缓存。

## 根因

1. **页级 `Suspense` + `useSearchParams`**  
   `signup` / `signin` 等页面为满足 Next.js 对 `useSearchParams` 的要求，用 `Suspense` 包裹，fallback 为整页 `BrandTextLoading`。每次进入新路由都会 remount 并短暂 suspend，从而再次展示 fallback。

2. **`useAuthConfig` 无共享缓存**  
   `src/libs/better-auth/use-auth-config.ts` 每次挂载都以 `config: null` 起步（`ready: false`），再 `fetch('/api/auth/config')`。signup 的 `SignupConfig`、signin 的 `SigninConfig` 分支因此在每次切换时再次渲染整页 Loading。

## 目标

- 首次进入 auth 页：允许一次 Loading（或极短空白）。
- 之后在 `/signup` ↔ `/signin`（以及其它共用 `useAuthConfig` 的页面）之间切换：不再出现整页品牌 Loading。
- 带 query（如 `email`、`callbackUrl`）的切换行为保持不变。

## 非目标

- 不引入 `(auth)` 路由分组或共享 Auth Layout Provider。
- 不把 auth 页的 search params 迁移到 nuqs。
- 不改登录/注册业务逻辑。
- 不改 `BrandTextLoading` 组件本身。
- 不做 TTL / 手动 invalidate / React Query。
- 不做 E2E；以 hook 单元测试 + 手工验收为准。

## 方案

采用「模块级配置缓存 + 收紧 Suspense fallback」（方案 A）。

### 1. `useAuthConfig` 模块级缓存

文件：`src/libs/better-auth/use-auth-config.ts`  
调用方 API 不变：`{ config, ready }`。

模块作用域：

```ts
let cachedConfig: AuthServerConfig | null = null
let inflight: Promise<AuthServerConfig> | null = null
```

行为：

| 状态 | 行为 |
|------|------|
| 已有 `cachedConfig` | 同步返回 `{ config, ready: true }`，不再 fetch |
| 无缓存但有 `inflight` | 复用同一 promise，并发挂载只发一次请求 |
| 都没有 | `fetch('/api/auth/config')`，成功写入 `cachedConfig` |
| fetch 失败 | 写入并缓存现有 `defaultConfig`，避免反复失败导致 Loading 循环 |

Hook 用 `useState` / `useEffect`（或等价订阅方式）消费缓存；缓存命中时首帧即为 `ready: true`。

会话内服务端 auth 配置变更不会自动刷新（可接受；整页 reload 即可）。

受影响调用方（无需改调用代码，自动受益）：

- `src/app/signin/useSignIn.ts`
- `src/app/signup/SignUpForm.tsx` / `useSignUp.ts`
- `src/app/verify-email/*`
- `src/app/settings/profile/components/LinkedAccountsSetting.tsx`

页面内「`!ready` 时渲染 Loading」的分支保留，作为首次加载安全网；缓存命中后不再进入。

### 2. 页级 Suspense fallback

保留 `Suspense`（满足 `useSearchParams` 要求），将 fallback 从 `<Loading debugId="..." />` 改为 `null`。

修改文件：

- `src/app/signup/page.tsx`
- `src/app/signin/page.tsx`
- `src/app/auth-error/page.tsx`
- `src/app/reset-password/page.tsx`
- `src/app/verify-email/page.tsx`

首次 suspend 可能出现极短空白，而不再是整页品牌 Loading；有配置缓存后，切换时主要路径应直接渲染表单。

## 错误处理

- `/api/auth/config` 失败：缓存 `defaultConfig`，与现有降级一致。
- 不新增 toast / 错误页。

## 测试

为 `use-auth-config` 增加 Vitest 单元测试（测试内需能重置模块级缓存，例如导出 `__resetAuthConfigCacheForTests` 或 `vi.resetModules`）：

1. 首次调用会 fetch，且 `ready` 从 false → true。
2. 第二次挂载（同模块）不再 fetch，首帧 `ready === true`。
3. 并发两次挂载只发一次 fetch（共享 `inflight`）。
4. fetch 失败时落到 `defaultConfig`，且后续不再重复请求。

手工验收：

1. 冷进 `/signin` 或 `/signup`：允许一次品牌 Loading 或极短空白。
2. 再切到另一端：不应再出现整页品牌 Loading。
3. 带 `?email=` / `?callbackUrl=` 切换，表单预填与回调行为不变。

## 改动文件清单

- `src/libs/better-auth/use-auth-config.ts`
- `src/libs/better-auth/use-auth-config.test.ts`（新建）
- `src/app/signup/page.tsx`
- `src/app/signin/page.tsx`
- `src/app/auth-error/page.tsx`
- `src/app/reset-password/page.tsx`
- `src/app/verify-email/page.tsx`
