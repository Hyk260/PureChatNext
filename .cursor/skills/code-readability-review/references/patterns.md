# 可读性改写模式

本文件按需加载。下面以 `src/features/dev/WechatConversationPage.tsx` 中的真实结构为 canonical 样例；同文件 `statusChip` 是仓库已接受的正例。

## 正例：Record 映射（对齐 statusChip）

```tsx
function statusChip(status?: string) {
  if (!status || status === 'completed') return null
  const map: Record<string, string> = {
    canceled: 'bg-slate-100 text-slate-600',
    failed: 'bg-rose-50 text-rose-700 ring-rose-200',
    pending: 'bg-sky-50 text-sky-700 ring-sky-200',
    processing: 'bg-amber-50 text-amber-700 ring-amber-200',
    retry: 'bg-orange-50 text-orange-700 ring-orange-200',
  }
  const label: Record<string, string> = {
    canceled: '已取消',
    failed: '失败',
    pending: '排队',
    processing: '处理中',
    retry: '重试',
  }
  return (
    <span className={`... ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {label[status] ?? status}
    </span>
  )
}
```

同类「枚举 → 文案/样式」优先用这种结构，而不是嵌套三元。

---

## 1. 嵌套三元文案 → Record lookup

**Before（不优雅）**

```tsx
const label =
  kind === 'command'
    ? '指令'
    : kind === 'unsupported'
      ? '不支持'
      : kind === 'image'
        ? '图片'
        : kind === 'file'
          ? '文件'
          : kind
```

**After**

```tsx
const KIND_LABEL: Record<string, string> = {
  command: '指令',
  unsupported: '不支持',
  image: '图片',
  file: '文件',
}
const label = KIND_LABEL[kind] ?? kind
```

何时用：≥2 层三元、分支是离散 key→value。常量可提到模块顶层（若多处复用）。

---

## 2. 权限/状态文案三元链 → 小函数或 lookup

**Before**

```tsx
const accessLabel = session.canSend
  ? '可代发'
  : session.isOwnBinding
    ? '只读'
    : '其它账号'
```

**After（early return 函数）**

```tsx
function getAccessLabel(canSend: boolean, isOwnBinding: boolean) {
  if (canSend) return '可代发'
  if (isOwnBinding) return '只读'
  return '其它账号'
}

const accessLabel = getAccessLabel(session.canSend, session.isOwnBinding)
```

**After（仅两布尔、仍想内联时）** — 也可用扁平 if，避免嵌套 `? :`。

何时用函数：同一套文案在列表项 + 输入框 placeholder 等多处出现，或分支 ≥3。

---

## 3. 嵌套 className 三元 → helper / 二维 lookup

**Before（换行过多、难扫读）**

```tsx
className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-medium ${
  session.canSend
    ? active
      ? 'bg-emerald-500/20 text-emerald-200'
      : 'bg-emerald-50 text-emerald-700'
    : active
      ? 'bg-white/10 text-slate-300'
      : 'bg-slate-100 text-slate-500'
}`}
```

**After（helper）**

```tsx
function getAccessChipClass(canSend: boolean, active: boolean) {
  if (canSend) {
    return active ? 'bg-emerald-500/20 text-emerald-200' : 'bg-emerald-50 text-emerald-700'
  }
  return active ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-500'
}

// 使用
className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-medium ${getAccessChipClass(session.canSend, active)}`}
```

**After（已有 cx / cn）**

```tsx
className={cx(
  'shrink-0 rounded px-1 py-0.5 text-[10px] font-medium',
  canSend && active && 'bg-emerald-500/20 text-emerald-200',
  canSend && !active && 'bg-emerald-50 text-emerald-700',
  !canSend && active && 'bg-white/10 text-slate-300',
  !canSend && !active && 'bg-slate-100 text-slate-500',
)}
```

Tailwind 文件无 `cn`/`cx` 时：优先 helper 或映射，**不要**为用上 cn 新建工具。

单层、两侧很短的三元可留在 JSX 内：`active ? 'text-slate-300' : 'text-slate-400'`。

---

## 4. 多分支 placeholder → early return 函数

**Before**

```tsx
placeholder={
  !selectedId
    ? '先选择会话'
    : canSend
      ? '以 Agent 身份发送文本…（Enter 发送，Shift+Enter 换行）'
      : selectedSession?.isOwnBinding
        ? '仅可向扫码授权的微信账号代发（当前会话只读）'
        : '其它账号的会话，仅可查看'
}
```

**After**

```tsx
function getComposerPlaceholder(
  selectedId: string | null,
  canSend: boolean,
  isOwnBinding?: boolean,
) {
  if (!selectedId) return '先选择会话'
  if (canSend) return '以 Agent 身份发送文本…（Enter 发送，Shift+Enter 换行）'
  if (isOwnBinding) return '仅可向扫码授权的微信账号代发（当前会话只读）'
  return '其它账号的会话，仅可查看'
}

// 使用
placeholder={getComposerPlaceholder(selectedId, canSend, selectedSession?.isOwnBinding)}
```

守卫顺序与原三元短路语义保持一致。

---

## 5. Early return 守卫

**Before**

```tsx
function render(item?: Item) {
  if (item) {
    if (item.visible) {
      return <Row item={item} />
    }
    return null
  }
  return null
}
```

**After**

```tsx
function render(item?: Item) {
  if (!item || !item.visible) return null
  return <Row item={item} />
}
```

失败/空路径先退出，主路径不缩进。

---

## 6. 过长 JSX 表达式 → 外提变量

**Before**

```tsx
<button
  disabled={!selectedId || sending || !canSend || draft.trim().length === 0}
  onClick={() => { /* ... */ }}
>
  {sending ? '发送中…' : !canSend ? '不可发送' : '发送'}
</button>
```

**After**

```tsx
const canSubmit = Boolean(selectedId) && canSend && !sending && draft.trim().length > 0
const sendLabel = sending ? '发送中…' : canSend ? '发送' : '不可发送'

<button disabled={!canSubmit} onClick={() => { /* ... */ }}>
  {sendLabel}
</button>
```

属性里只留短表达式；计算与命名留在 JSX 外。单层短三元作 label 可保留。

---

## 7. cx / cn 扁平组合（文件已有时）

**Before**

```tsx
className={`${styles.row} ${active ? styles.rowActive : ''} ${disabled ? styles.rowDisabled : ''}`}
```

**After**

```tsx
className={cx(styles.row, active && styles.rowActive, disabled && styles.rowDisabled)}
```

本仓库 CSS modules / antd-style 场景常见 `cx`。布尔为 false 时 `&&` 得到 falsy，由 `cx` 忽略即可。

---

## 选择速查

| 情况 | 首选 |
|------|------|
| 离散 key → 文案/样式 | `Record` lookup |
| 有序守卫（无选中 → 不可发 → …） | early return 函数 |
| 2×2 状态矩阵 className | helper 或扁平 `cx`/`cn` |
| 单层、两侧很短 | 可保留内联三元 |
| 逻辑出现在多个 JSX 属性/位置 | 提取命名变量或 helper |
