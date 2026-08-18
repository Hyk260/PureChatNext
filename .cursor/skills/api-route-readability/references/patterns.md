# API 路由可读性改写模式

本文件按需加载。样例取自本仓库 `src/app/api/` 的真实结构；改写只动书写风格，短路顺序与返回值保持不变。

## 选择速查

| 情况 | 首选 |
|------|------|
| 有序守卫（先 A 再 B 再 C） | 同文件小函数 + early return |
| 离散 key → 文案 | `Record` lookup + fallback |
| 单层、两侧很短 | 可保留内联三元 |
| 复杂条件出现在 JSON 字面量里 | 先赋名再放入响应 |

---

## 1. 有序守卫嵌套三元 → early return

微信 status：`needsRebind` → gateway → 首心跳 → 心跳过期 → 失败事件 → 库存状态。这是优先级链，不是离散 key 映射。

**Before**

```ts
const runtimeStatus = binding.needsRebind
  ? 'needs_rebind'
  : !gatewaySupported
    ? 'offline'
    : waitingForFirstHeartbeat
      ? 'starting'
      : heartbeatStale
        ? 'offline'
        : failedEventCount > 0
          ? 'degraded'
          : binding.runtimeStatus
```

**After**

```ts
function resolveWechatRuntimeStatus(input: {
  failedEventCount: number
  gatewaySupported: boolean
  heartbeatStale: boolean
  needsRebind: boolean
  runtimeStatus: string
  waitingForFirstHeartbeat: boolean
}) {
  if (input.needsRebind) return 'needs_rebind'
  if (!input.gatewaySupported) return 'offline'
  if (input.waitingForFirstHeartbeat) return 'starting'
  if (input.heartbeatStale) return 'offline'
  if (input.failedEventCount > 0) return 'degraded'
  return input.runtimeStatus
}
```

`if` 顺序必须与原三元短路一致。已命名的布尔（如 `waitingForFirstHeartbeat` 的 `&&` 链）不要再拆语义，只作为输入传入。

---

## 2. 双分支嵌套三元 → 扁平守卫

QQ status：webhook 看 `enabled`，否则看 gateway / 心跳。

**Before**

```ts
const runtimeStatus = connectionMode === 'webhook'
  ? binding.enabled ? 'online' : 'offline'
  : !gatewaySupported || !heartbeatFresh ? 'offline' : binding.runtimeStatus
```

**After**

```ts
function resolveQqRuntimeStatus(input: {
  connectionMode: 'websocket' | 'webhook'
  enabled: boolean
  gatewaySupported: boolean
  heartbeatFresh: boolean
  runtimeStatus: string
}) {
  if (input.connectionMode === 'webhook') {
    return input.enabled ? 'online' : 'offline'
  }
  if (!input.gatewaySupported || !input.heartbeatFresh) return 'offline'
  return input.runtimeStatus
}
```

webhook 内单层 `enabled ? 'online' : 'offline'` 可以保留。响应里的 `connected` 提到命名变量，避免塞进 `NextResponse.json`。

---

## 3. 健康检查嵌套三元 → 扁平 if

**Before**

```ts
const unhealthy = gateway.status === 'unhealthy'
return Response.json(
  { gateway, status: unhealthy ? 'unhealthy' : gateway.status === 'degraded' ? 'degraded' : 'ok' },
  { headers: responseHeaders, status: unhealthy ? 503 : 200 },
)
```

**After**

```ts
function resolveHealthStatus(unhealthy: boolean, gatewayStatus: string) {
  if (unhealthy) return 'unhealthy'
  if (gatewayStatus === 'degraded') return 'degraded'
  return 'ok'
}

const unhealthy = gateway.status === 'unhealthy'
return Response.json(
  { gateway, status: resolveHealthStatus(unhealthy, gateway.status) },
  { headers: responseHeaders, status: unhealthy ? 503 : 200 },
)
```

不要为了对齐风格改成 `NextResponse.json`，也不要丢掉 `gateway` 字段。HTTP 503 仍只由 `unhealthy` 决定。

---

## 4. 枚举文案三元链 → Record lookup

**Before**

```ts
const role = message.role === 'user' ? '用户' : message.role === 'assistant' ? '助手' : '系统'
```

**After**

```ts
const ROLE_LABEL: Record<string, string> = {
  assistant: '助手',
  user: '用户',
}
const role = ROLE_LABEL[message.role] ?? '系统'
```

何时用：≥2 层三元、分支是离散 key→value。fallback 必须覆盖原 `else` 分支。

---

## 5. Early return 守卫（已有正例）

对齐 `src/app/api/channels/wechat/webhook/[applicationId]/route.ts`：

```ts
if (!authorizeWechatWebhook(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
if (!applicationId) return NextResponse.json({ error: 'Invalid applicationId' }, { status: 400 })
if (!parsed.success) return NextResponse.json({ error: 'Invalid batch' }, { status: 400 })
if (!binding?.enabled) return NextResponse.json({ error: 'Binding not found' }, { status: 404 })
```

失败路径先退出；不要为「统一 helper」把 `jsonError` 和 `NextResponse.json` 互改。

---

## 6. JSDoc

**Before**

```ts
/**
 * GET
 * /api/channels/wechat/qrcode/status?qrcode=
 * — 轮询扫码状态
 * */
```

**After**

```ts
/**
 * GET /api/channels/wechat/qrcode/status
 * 轮询扫码状态
 * @param request - query `qrcode`
 */
```

路径一行、用途一行；body / query 用 `@param request`。

---

## 明确保留

```ts
const message = error instanceof Error ? error.message : 'Unknown error'
lastActiveAt: binding.lastActiveAt?.toISOString() ?? null
lastError: binding.lastErrorCode
  ? { code: binding.lastErrorCode, message: binding.lastErrorMessage || '微信渠道暂时异常' }
  : null
```

单层、两侧短、语义一眼能看懂时不要改。
