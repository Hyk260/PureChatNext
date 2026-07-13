# Auth Loading Flash Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 首次进入 auth 页允许 Loading；之后 `/signup` ↔ `/signin`（及共用 `useAuthConfig` 的页面）切换时不再整页品牌 Loading 闪烁。

**Architecture:** 在 `use-auth-config.ts` 内增加模块级 `cachedConfig` + `inflight` promise，缓存命中时 hook 首帧 `ready: true`；auth 相关页的 `Suspense` fallback 从 `BrandTextLoading` 改为 `null`。不改路由结构、不引入 Context/React Query。

**Tech Stack:** React 19、Vitest + happy-dom、Next.js App Router client pages、现有 `fetch('/api/auth/config')`。

**Spec:** `docs/superpowers/specs/2026-07-13-auth-loading-flash-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `src/libs/better-auth/use-auth-config.ts` | 模块级缓存 + `loadAuthServerConfig` + `useAuthConfig` hook；测试用 `resetAuthConfigCacheForTests` |
| `src/libs/better-auth/use-auth-config.test.ts` | 缓存/去重/失败降级的单元测试（无 `@testing-library/react`，测纯函数层） |
| `src/app/signup/page.tsx` | Suspense fallback → `null` |
| `src/app/signin/page.tsx` | Suspense fallback → `null` |
| `src/app/auth-error/page.tsx` | Suspense fallback → `null` |
| `src/app/reset-password/page.tsx` | Suspense fallback → `null` |
| `src/app/verify-email/page.tsx` | Suspense fallback → `null` |

页面内 `!ready` → `Loading` 分支保留，不删除。

---

### Task 1: 为 auth config 缓存写失败测试（TDD）

**Files:**
- Create: `src/libs/better-auth/use-auth-config.test.ts`
- Modify (稍后 Task 2): `src/libs/better-auth/use-auth-config.ts`

- [ ] **Step 1: 写失败测试文件**

创建 `src/libs/better-auth/use-auth-config.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthServerConfig } from '@/libs/better-auth/get-auth-config'

const mockConfig: AuthServerConfig = {
  emailVerificationMode: 'link',
  enableEmailVerification: true,
  enableMagicLink: true,
  oAuthSSOProviders: ['github'],
}

const defaultConfig: AuthServerConfig = {
  emailVerificationMode: 'otp',
  enableEmailVerification: false,
  enableMagicLink: false,
  oAuthSSOProviders: [],
}

describe('auth config cache', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function loadModule() {
    const mod = await import('./use-auth-config')
    mod.resetAuthConfigCacheForTests()
    return mod
  }

  it('fetches once and caches the successful config', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => mockConfig,
    })
    vi.stubGlobal('fetch', fetchMock)

    const { loadAuthServerConfig, getCachedAuthConfig } = await loadModule()

    await expect(loadAuthServerConfig()).resolves.toEqual(mockConfig)
    expect(getCachedAuthConfig()).toEqual(mockConfig)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/config')

    await expect(loadAuthServerConfig()).resolves.toEqual(mockConfig)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shares a single inflight request for concurrent callers', async () => {
    let resolveJson: (value: AuthServerConfig) => void = () => {}
    const jsonPromise = new Promise<AuthServerConfig>((resolve) => {
      resolveJson = resolve
    })

    const fetchMock = vi.fn().mockResolvedValue({
      json: () => jsonPromise,
    })
    vi.stubGlobal('fetch', fetchMock)

    const { loadAuthServerConfig } = await loadModule()

    const p1 = loadAuthServerConfig()
    const p2 = loadAuthServerConfig()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveJson(mockConfig)
    await expect(Promise.all([p1, p2])).resolves.toEqual([mockConfig, mockConfig])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('caches defaultConfig when fetch fails and does not refetch', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'))
    vi.stubGlobal('fetch', fetchMock)

    const { loadAuthServerConfig, getCachedAuthConfig } = await loadModule()

    await expect(loadAuthServerConfig()).resolves.toEqual(defaultConfig)
    expect(getCachedAuthConfig()).toEqual(defaultConfig)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await expect(loadAuthServerConfig()).resolves.toEqual(defaultConfig)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run:

```bash
pnpm exec vitest run --silent='passed-only' 'src/libs/better-auth/use-auth-config.test.ts'
```

Expected: FAIL（缺少 `resetAuthConfigCacheForTests` / `loadAuthServerConfig` / `getCachedAuthConfig` 导出，或模块行为不符）。

- [ ] **Step 3: 实现模块级缓存 + 导出**

将 `src/libs/better-auth/use-auth-config.ts` 替换为：

```ts
'use client'

import { useEffect, useState } from 'react'

import type { AuthServerConfig } from '@/libs/better-auth/get-auth-config'

const defaultConfig: AuthServerConfig = {
  emailVerificationMode: 'otp',
  enableEmailVerification: false,
  enableMagicLink: false,
  oAuthSSOProviders: [],
}

let cachedConfig: AuthServerConfig | null = null
let inflight: Promise<AuthServerConfig> | null = null

export const getCachedAuthConfig = (): AuthServerConfig | null => cachedConfig

export const resetAuthConfigCacheForTests = (): void => {
  cachedConfig = null
  inflight = null
}

export const loadAuthServerConfig = (): Promise<AuthServerConfig> => {
  if (cachedConfig) return Promise.resolve(cachedConfig)
  if (inflight) return inflight

  inflight = fetch('/api/auth/config')
    .then((response) => response.json() as Promise<AuthServerConfig>)
    .then((data) => {
      cachedConfig = data
      return data
    })
    .catch(() => {
      cachedConfig = defaultConfig
      return defaultConfig
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}

export const useAuthConfig = () => {
  const [config, setConfig] = useState<AuthServerConfig | null>(() => cachedConfig)

  useEffect(() => {
    let cancelled = false

    if (cachedConfig) {
      setConfig(cachedConfig)
      return
    }

    void loadAuthServerConfig().then((data) => {
      if (!cancelled) setConfig(data)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return {
    config: config ?? defaultConfig,
    ready: config !== null,
  }
}
```

要点：

- `useState(() => cachedConfig)` 保证缓存命中时首帧 `ready === true`
- 公开 API 仍为 `{ config, ready }`；调用方无需改
- `resetAuthConfigCacheForTests` / `getCachedAuthConfig` / `loadAuthServerConfig` 仅供测试与 hook 内部使用（可接受导出）

- [ ] **Step 4: 再跑测试，确认通过**

Run:

```bash
pnpm exec vitest run --silent='passed-only' 'src/libs/better-auth/use-auth-config.test.ts'
```

Expected: PASS（3 tests）

- [ ] **Step 5: Commit**

```bash
git add src/libs/better-auth/use-auth-config.ts src/libs/better-auth/use-auth-config.test.ts
git commit -m "$(cat <<'EOF'
fix: 为 useAuthConfig 增加模块级缓存避免切换闪烁

EOF
)"
```

---

### Task 2: 将 auth 页 Suspense fallback 改为 null

**Files:**
- Modify: `src/app/signup/page.tsx`
- Modify: `src/app/signin/page.tsx`
- Modify: `src/app/auth-error/page.tsx`
- Modify: `src/app/reset-password/page.tsx`
- Modify: `src/app/verify-email/page.tsx`

- [ ] **Step 1: 更新 signup**

`src/app/signup/page.tsx` — 去掉未使用的 Loading import，Suspense fallback 改为 `null`：

```tsx
'use client'

import { Suspense } from 'react'

import { AuthPageContainer } from '@/components/AuthPageContainer'

import { SignUpForm } from './SignUpForm'

const SignUpContent = () => {
  return (
    <AuthPageContainer>
      <SignUpForm />
    </AuthPageContainer>
  )
}

const SignUpPage = () => {
  return (
    <Suspense fallback={null}>
      <SignUpContent />
    </Suspense>
  )
}

export default SignUpPage
```

- [ ] **Step 2: 更新 signin**

`src/app/signin/page.tsx` — 保留 `Loading` import（`SigninConfig` 分支仍用），仅改页级 Suspense：

```tsx
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
```

- [ ] **Step 3: 更新 auth-error / reset-password / verify-email**

三处页级 Suspense 均改为 `fallback={null}`，并删除因此变为未使用的 `Loading` import（若该文件其它地方仍用 Loading 则保留）。

`auth-error/page.tsx`:

```tsx
    <Suspense fallback={null}>
      <AuthErrorContent />
    </Suspense>
```

`reset-password/page.tsx`:

```tsx
    <Suspense fallback={null}>
      <ResetPasswordPageContent />
    </Suspense>
```

`verify-email/page.tsx`:

```tsx
    <Suspense fallback={null}>
      <VerifyEmailPageContent />
    </Suspense>
```

改完后确认各文件无未使用 import（`Loading` 若仍被 content 使用则保留）。

- [ ] **Step 4: Commit**

```bash
git add \
  src/app/signup/page.tsx \
  src/app/signin/page.tsx \
  src/app/auth-error/page.tsx \
  src/app/reset-password/page.tsx \
  src/app/verify-email/page.tsx
git commit -m "$(cat <<'EOF'
fix: auth 页 Suspense fallback 改为 null 避免品牌 Loading 闪烁

EOF
)"
```

---

### Task 3: 手工验收

**Files:** 无代码改动

- [ ] **Step 1: 启动开发服务器（若未运行）**

```bash
pnpm dev
```

- [ ] **Step 2: 冷启动验收**

1. 硬刷新打开 `http://localhost:3000/signin`
2. 允许出现一次品牌 Loading（`SigninConfig`）或极短空白
3. 表单正常出现

- [ ] **Step 3: 切换验收**

1. 点击「去注册」进入 `/signup`（可带现有 query）
2. **不应**再出现整页品牌 Loading
3. 再点「去登录」回 `/signin`，同样不应闪整页品牌 Loading
4. 用 `http://localhost:3000/signup?email=test@example.com` 切换到 signin，确认 email 预填等行为仍正常

- [ ] **Step 4: 回归测试命令**

```bash
pnpm exec vitest run --silent='passed-only' 'src/libs/better-auth/use-auth-config.test.ts'
```

Expected: PASS

若手工验收发现问题，在本会话修复后追加 commit，不要改 spec 范围（不引入 auth layout / nuqs）。

---

## Spec coverage checklist

| Spec 要求 | Task |
|-----------|------|
| 模块级 `cachedConfig` + `inflight` | Task 1 |
| 缓存命中同步 `ready: true` | Task 1（`useState(() => cachedConfig)`） |
| fetch 失败缓存 `defaultConfig` | Task 1 |
| 调用方 API 不变 | Task 1 |
| signup/signin Suspense → `null` | Task 2 |
| auth-error/reset-password/verify-email 一并改 | Task 2 |
| 保留 `!ready` Loading 分支 | Task 2（不删） |
| 单元测试四类场景（fetch/缓存/并发/失败） | Task 1（成功后不 refetch 覆盖「后续不再请求」） |
| 手工验收 signup↔signin | Task 3 |
| 不引入 layout/nuqs/TTL | 全计划遵守 |
