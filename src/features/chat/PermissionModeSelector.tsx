'use client'

import { Icon, Modal, Popover } from '@pure/ui'
import { cssVar } from 'antd-style'
import {
  Check,
  ChevronDown,
  Folder,
  Globe2,
  Hand,
  ShieldAlert,
  ShieldCheck,
  SquareTerminal,
  TriangleAlert,
} from 'lucide-react'
import { memo, useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { ChatPermissionMode } from '@pure/types'
import { useApp } from '@/components/AntdStaticMethods'
import { getDesktopApi } from '@/types/desktop'

type PermissionOption = {
  description: string
  icon: LucideIcon
  label: string
  mode: ChatPermissionMode
}

const OPTIONS: PermissionOption[] = [
  {
    description: '编辑文件和使用互联网时始终询问',
    icon: Hand,
    label: '请求批准',
    mode: 'ask',
  },
  {
    description: '仅对检测到的风险操作请求批准',
    icon: ShieldCheck,
    label: '帮我批准',
    mode: 'auto',
  },
  {
    description: '不受限制地访问互联网和这台电脑上的文件',
    icon: ShieldAlert,
    label: '完全访问权限',
    mode: 'full',
  },
]

const RISKS = [
  { description: '读取、创建、修改、上传或删除任意位置的文件', icon: Folder, label: '文件和文件夹' },
  { description: '运行命令、安装软件和更改系统设置', icon: SquareTerminal, label: '终端命令' },
  { description: '访问网站、发送数据并使用已连接的应用', icon: Globe2, label: '互联网和已连接的应用' },
]

function pathBasename(value: string) {
  return value.split(/[/\\]/).filter(Boolean).at(-1) ?? value
}

interface PermissionModeSelectorProps {
  disabled?: boolean
  onChange: (mode: ChatPermissionMode) => Promise<void> | void
  topicId?: string
  value: ChatPermissionMode
}

const PermissionModeSelector = memo<PermissionModeSelectorProps>(({ disabled, onChange, topicId = 'draft', value }) => {
  const { message } = useApp()
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [savingMode, setSavingMode] = useState<ChatPermissionMode | null>(null)
  const [choosingScope, setChoosingScope] = useState(false)
  const [scopePath, setScopePath] = useState<string | null>(null)
  const current = OPTIONS.find((option) => option.mode === value) ?? OPTIONS[1]
  const scopeLabel = scopePath ? pathBasename(scopePath) : null

  useEffect(() => {
    const api = getDesktopApi()
    if (!api?.getPermissionScope) {
      setScopePath(null)
      return
    }
    let cancelled = false
    void api
      .getPermissionScope(topicId)
      .then((result) => {
        if (!cancelled) setScopePath(result.scope)
      })
      .catch(() => {
        if (!cancelled) setScopePath(null)
      })
    return () => {
      cancelled = true
    }
  }, [topicId])

  const applyMode = async (mode: ChatPermissionMode) => {
    setSavingMode(mode)
    try {
      await onChange(mode)
      setOpen(false)
      return true
    } catch {
      return false
    } finally {
      setSavingMode(null)
    }
  }

  const handleSelect = async (mode: ChatPermissionMode) => {
    if (mode === value) {
      setOpen(false)
      return
    }
    if (mode === 'full') {
      setOpen(false)
      setConfirmOpen(true)
      return
    }
    await applyMode(mode)
  }

  const handleConfirm = async () => {
    if (await applyMode('full')) setConfirmOpen(false)
  }

  const handleChooseScope = async () => {
    const api = getDesktopApi()
    if (!api?.chooseDirectory || !api.setPermissionScope) {
      message.error('当前环境不支持选择工作目录')
      return
    }

    // 先关闭 Popover，再打开系统对话框，避免 macOS 焦点被浮层抢走后静默失败
    setOpen(false)
    setChoosingScope(true)
    try {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve())
      })
      const scope = await api.chooseDirectory()
      if (!scope) return
      const result = await api.setPermissionScope(topicId, scope)
      setScopePath(result.scope)
      message.success(`已设置工作目录：${pathBasename(result.scope)}`)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '设置工作目录失败')
    } finally {
      setChoosingScope(false)
    }
  }

  const popoverContent = (
    <div className='w-[min(360px,calc(100vw-32px))] p-1'>
      <div className='px-3 pb-2 pt-1 text-sm font-medium text-muted-foreground'>PureChat 应如何请求批准？</div>
      <div className='flex flex-col gap-1'>
        {OPTIONS.map((option) => {
          const active = option.mode === value
          const danger = option.mode === 'full'
          return (
            <button
              aria-pressed={active}
              className={
                danger
                  ? 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-red-500 hover:bg-red-500/10'
                  : 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-foreground hover:bg-secondary'
              }
              disabled={savingMode !== null || choosingScope}
              key={option.mode}
              type='button'
              onClick={() => void handleSelect(option.mode)}
            >
              <Icon icon={option.icon} size={19} />
              <span className='min-w-0 flex-1'>
                <span className='block text-sm font-medium'>{option.label}</span>
                <span className='block text-xs leading-5 text-muted-foreground'>{option.description}</span>
              </span>
              {active ? <Icon icon={Check} size={17} /> : null}
            </button>
          )
        })}
      </div>
      <button
        className='mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs text-muted-foreground hover:bg-secondary'
        disabled={choosingScope}
        title={scopePath ?? undefined}
        type='button'
        onClick={() => void handleChooseScope()}
      >
        <Icon icon={Folder} size={16} />
        <span className='min-w-0 flex-1 truncate'>
          {scopeLabel ? `工作目录：${scopeLabel}` : '选择工作目录'}
        </span>
      </button>
    </div>
  )

  return (
    <>
      <Popover
        content={popoverContent}
        open={open}
        placement='topLeft'
        styles={{ content: { border: `1px solid ${cssVar.colorBorderSecondary}`, padding: 0 } }}
        trigger='click'
        onOpenChange={(nextOpen) => !disabled && !choosingScope && setOpen(nextOpen)}
      >
        <button
          aria-expanded={open}
          aria-label={`权限模式：${current.label}`}
          className='flex h-8 items-center gap-1.5 rounded-full px-2 text-xs text-muted-foreground hover:bg-secondary'
          disabled={disabled}
          type='button'
        >
          <Icon icon={current.icon} size={14} />
          <span>{current.label}</span>
          <Icon icon={ChevronDown} size={12} />
        </button>
      </Popover>

      <Modal
        cancelText='取消'
        closable={false}
        confirmLoading={savingMode === 'full'}
        destroyOnHidden
        okButtonProps={{ danger: true }}
        okText='确认'
        open={confirmOpen}
        title={
          <span className='flex items-center gap-2'>
            <Icon icon={TriangleAlert} size={22} />
            要开启完全访问权限吗？
          </span>
        }
        width='min(92vw, 680px)'
        onCancel={() => setConfirmOpen(false)}
        onOk={() => void handleConfirm()}
      >
        <div className='flex flex-col gap-4 py-2'>
          <p className='m-0 text-sm leading-6 text-muted-foreground'>
            PureChat 将能够在未经您逐次许可的情况下使用受支持的工具。这包括但不限于：
          </p>
          <div className='divide-y divide-border rounded-2xl bg-secondary px-4'>
            {RISKS.map((risk) => (
              <div className='flex items-center gap-4 py-3' key={risk.label}>
                <Icon icon={risk.icon} size={22} />
                <div className='min-w-0'>
                  <div className='text-sm font-medium text-foreground'>{risk.label}</div>
                  <div className='text-xs leading-5 text-muted-foreground'>{risk.description}</div>
                </div>
              </div>
            ))}
          </div>
          <p className='m-0 text-sm leading-6 text-muted-foreground'>
            这可能带来敏感数据丢失或泄露、提示注入等风险。您可以随时切换为更安全的权限模式。
          </p>
        </div>
      </Modal>
    </>
  )
})

PermissionModeSelector.displayName = 'PermissionModeSelector'

export default PermissionModeSelector
