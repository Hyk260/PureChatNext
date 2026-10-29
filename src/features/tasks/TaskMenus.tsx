'use client'

import { Button, DropdownMenu, Text } from '@lobehub/ui'
import type { DropdownItem } from '@lobehub/ui'
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { TaskPriority, TaskStatus } from '@pure/types'
import { TASK_STATUSES } from '@pure/types'

import { TASK_PRIORITY_OPTIONS, TASK_STATUS_META } from './presentation'

function useMenuShortcuts<T>(open: boolean, options: readonly T[], select: (value: T) => void, close: () => void) {
  useEffect(() => {
    if (!open) return
    const handle = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || !/^[1-9]$/.test(event.key)) return
      const value = options[Number(event.key) - 1]
      if (value === undefined) return
      event.preventDefault()
      event.stopPropagation()
      select(value)
      close()
    }
    document.addEventListener('keydown', handle, true)
    return () => document.removeEventListener('keydown', handle, true)
  }, [close, open, options, select])
}

const PRIORITY_VALUES = TASK_PRIORITY_OPTIONS.map((item) => item.value)

export function TaskPriorityMenu({
  value,
  onChange,
  compact = false,
  disabled = false,
}: {
  value: TaskPriority
  onChange: (value: TaskPriority) => void
  compact?: boolean
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const option = TASK_PRIORITY_OPTIONS[value]!
  const Icon = option.icon
  useMenuShortcuts(open, PRIORITY_VALUES, onChange, () => setOpen(false))
  const items: DropdownItem[] = TASK_PRIORITY_OPTIONS.map((item, index) => ({
    key: String(item.value),
    label: item.label,
    icon: <item.icon className={item.className} color={item.color} size={16} />,
    extra: (
      <Text as='span' className='flex items-center gap-3 text-muted-foreground'>
        {value === item.value && <Check size={14} />}
        {index + 1}
      </Text>
    ),
    onClick: () => onChange(item.value),
  }))
  return (
    <DropdownMenu items={items} open={open} onOpenChange={setOpen} placement='bottomLeft'>
      <Button aria-label={`优先级：${option.label}`} disabled={disabled} size='small' type='text' title={option.label}>
        <Icon className={option.className} color={option.color} size={16} />
        {!compact && option.label}
      </Button>
    </DropdownMenu>
  )
}

export function TaskStatusMenu({
  value,
  onChange,
  compact = false,
  disabled = false,
}: {
  value: TaskStatus
  onChange: (value: TaskStatus) => void
  compact?: boolean
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const option = TASK_STATUS_META[value]
  const Icon = option.icon
  useMenuShortcuts(open, TASK_STATUSES, onChange, () => setOpen(false))
  const items: DropdownItem[] = TASK_STATUSES.map((status, index) => {
    const item = TASK_STATUS_META[status]
    const ItemIcon = item.icon
    return {
      key: status,
      label: item.label,
      icon: <ItemIcon className={item.className} color={item.color} size={16} />,
      extra: (
        <Text as='span' className='flex items-center gap-3 text-muted-foreground'>
          {value === status && <Check size={14} />}
          {index + 1}
        </Text>
      ),
      onClick: () => onChange(status),
    }
  })
  return (
    <DropdownMenu items={items} open={open} onOpenChange={setOpen} placement='bottomLeft'>
      <Button
        aria-label={`任务状态：${option.label}`}
        disabled={disabled}
        size='small'
        title={option.label}
        type='text'
      >
        <Icon className={option.className} color={option.color} size={16} />
        {!compact && option.label}
      </Button>
    </DropdownMenu>
  )
}
