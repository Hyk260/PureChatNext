'use client'

import { ActionIcon, Alert, Button, Flex, Input, Modal, Select, Text, Tooltip } from '@pure/ui'
import {
  CircleHelp,
  Hash,
  ListFilter,
  Plus,
  RotateCcw,
  ScanFace,
  Trash2,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { memo, useCallback, useState } from 'react'

type AccessPolicy = 'allowlist' | 'disabled' | 'open'
type AccessPolicyScope = 'dm' | 'group'

type AllowedUser = {
  id: string
  platformUserId: string
  remark: string
}

type AdvancedSettingsDraft = {
  allowedUsers: AllowedUser[]
  charLimit: string
  dmPolicy: AccessPolicy
  groupPolicy: AccessPolicy
  platformUserId: string
}

const ACCESS_POLICY_META: Record<
  AccessPolicy,
  { description: Record<AccessPolicyScope, string>; label: string }
> = {
  open: {
    description: {
      dm: '接受任何人发送的私信',
      group: '接受任何人发送的群消息',
    },
    label: '开放',
  },
  allowlist: {
    description: {
      dm: '仅允许名单内的用户发送私信',
      group: '仅允许名单内的用户发送群消息',
    },
    label: '白名单',
  },
  disabled: {
    description: {
      dm: '拒绝所有私信',
      group: '拒绝所有群消息',
    },
    label: '禁用',
  },
}

const ACCESS_POLICY_VALUES = ['open', 'allowlist', 'disabled'] as const satisfies AccessPolicy[]

/** Outbound character limit default and hard upper bound for the preview UI. */
const DEFAULT_CHAR_LIMIT = 2000
const MIN_CHAR_LIMIT = 1
const MAX_CHAR_LIMIT = 2000

/** Shared width for character-limit + policy controls so they visually align. */
const COMPACT_CONTROL_WIDTH = 140
const PLATFORM_ID_CONTROL_WIDTH = 280

const DEFAULT_DRAFT: AdvancedSettingsDraft = {
  allowedUsers: [],
  charLimit: String(DEFAULT_CHAR_LIMIT),
  dmPolicy: 'open',
  groupPolicy: 'open',
  platformUserId: '',
}

function digitsOnly(raw: string) {
  return raw.replace(/\D/g, '')
}

/** Clamp a digit string into [MIN_CHAR_LIMIT, MAX_CHAR_LIMIT]; empty falls back to default. */
function clampCharLimit(raw: string): string {
  const digits = digitsOnly(raw)
  if (!digits) return String(DEFAULT_CHAR_LIMIT)
  const value = Number(digits)
  if (!Number.isFinite(value) || value < MIN_CHAR_LIMIT) return String(MIN_CHAR_LIMIT)
  if (value > MAX_CHAR_LIMIT) return String(MAX_CHAR_LIMIT)
  return String(value)
}

function createAllowedUser(): AllowedUser {
  return {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    platformUserId: '',
    remark: '',
  }
}

function AdvancedSettingRow({
  children,
  icon,
  label,
  labelExtra,
  wide,
}: {
  children?: ReactNode
  icon: ReactNode
  label: string
  labelExtra?: ReactNode
  /** Put the control column on the right with flex-1 (for multi-line editors). */
  wide?: boolean
}) {
  return (
    <div className='border-b border-border py-3.5 last:border-b-0'>
      <Flex className={`gap-4 ${wide ? 'items-start' : 'items-center justify-between'}`}>
        <Flex className='min-w-0 shrink-0 items-center gap-2.5'>
          <span className='flex size-5 shrink-0 items-center justify-center text-muted-foreground'>{icon}</span>
          <span className='text-sm text-foreground'>{label}</span>
          {labelExtra}
        </Flex>
        {children ? <div className={wide ? 'min-w-0 flex-1' : 'shrink-0'}>{children}</div> : null}
      </Flex>
    </div>
  )
}

function AccessPolicySelect({
  onChange,
  scope,
  value,
}: {
  onChange: (value: AccessPolicy) => void
  scope: AccessPolicyScope
  value: AccessPolicy
}) {
  return (
    <Select
      optionRender={(option) => {
        const policy = option.value as AccessPolicy
        const meta = ACCESS_POLICY_META[policy]
        return (
          <Flex className='w-full min-w-[320px] items-center justify-between gap-6'>
            <span>{meta.label}</span>
            <span className='text-xs text-muted-foreground'>{meta.description[scope]}</span>
          </Flex>
        )
      }}
      options={ACCESS_POLICY_VALUES.map((policy) => ({
        label: ACCESS_POLICY_META[policy].label,
        value: policy,
      }))}
      popupMatchSelectWidth={360}
      style={{ width: COMPACT_CONTROL_WIDTH }}
      value={value}
      onChange={(next) => {
        if (typeof next === 'string') onChange(next as AccessPolicy)
      }}
    />
  )
}

function AllowedUsersEditor({
  onAdd,
  onChange,
  onRemove,
  users,
}: {
  onAdd: () => void
  onChange: (id: string, patch: Partial<Pick<AllowedUser, 'platformUserId' | 'remark'>>) => void
  onRemove: (id: string) => void
  users: AllowedUser[]
}) {
  return (
    <Flex className='flex-col gap-2'>
      {users.length === 0 ? (
        <Text className='text-[13px]' type='secondary'>
          尚未添加任何用户
        </Text>
      ) : null}
      {users.map((user) => (
        <Flex key={user.id} className='items-center gap-2'>
          <Input
            className='min-w-0 flex-1'
            placeholder='平台用户 ID'
            value={user.platformUserId}
            onChange={(event) => onChange(user.id, { platformUserId: event.target.value })}
          />
          <Input
            className='min-w-0 flex-[1.2]'
            placeholder='如：张三（仅你自己可见）'
            value={user.remark}
            onChange={(event) => onChange(user.id, { remark: event.target.value })}
          />
          <ActionIcon
            icon={Trash2}
            size='small'
            title='移除用户'
            onClick={() => onRemove(user.id)}
          />
        </Flex>
      ))}
      <button
        className='inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground transition hover:border-foreground/30 hover:text-foreground'
        type='button'
        onClick={onAdd}
      >
        <Plus className='size-4' />
        添加用户
      </button>
    </Flex>
  )
}

type QQAdvancedSettingsModalProps = {
  onClose: () => void
  open: boolean
}

/**
 * QQ channel advanced-settings preview UI.
 * TODO(qq-advanced-settings): load/save via channel bind API.
 */
const QQAdvancedSettingsModal = memo<QQAdvancedSettingsModalProps>(({ onClose, open }) => {
  const [draft, setDraft] = useState<AdvancedSettingsDraft>(DEFAULT_DRAFT)

  const resetDefaults = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
  }, [])

  const patchDraft = useCallback((patch: Partial<AdvancedSettingsDraft>) => {
    setDraft((current) => ({ ...current, ...patch }))
  }, [])

  const addAllowedUser = useCallback(() => {
    setDraft((current) => ({
      ...current,
      allowedUsers: [...current.allowedUsers, createAllowedUser()],
    }))
  }, [])

  const removeAllowedUser = useCallback((id: string) => {
    setDraft((current) => ({
      ...current,
      allowedUsers: current.allowedUsers.filter((user) => user.id !== id),
    }))
  }, [])

  const updateAllowedUser = useCallback(
    (id: string, patch: Partial<Pick<AllowedUser, 'platformUserId' | 'remark'>>) => {
      setDraft((current) => ({
        ...current,
        allowedUsers: current.allowedUsers.map((user) => (user.id === id ? { ...user, ...patch } : user)),
      }))
    },
    []
  )

  return (
    <Modal
      destroyOnHidden
      footer={null}
      open={open}
      title='高级设置'
      width={720}
      onCancel={onClose}
    >
      <Flex className='mb-3 flex-col gap-3'>
        <Alert
          showIcon
          type='info'
          title='界面预览'
          description='当前仅展示高级设置布局，修改不会保存，关闭后恢复默认。'
        />
        <Flex className='items-center justify-end'>
          <Button icon={<RotateCcw size={14} />} size='small' onClick={resetDefaults}>
            恢复默认配置
          </Button>
        </Flex>
      </Flex>

      <div className='px-0.5'>
        <AdvancedSettingRow
          icon={<ScanFace className='size-4' />}
          label='你的平台用户 ID'
          labelExtra={
            <Tooltip title='用于标识你在该平台上的身份；后续可用于访问控制与会话归属。'>
              <CircleHelp className='size-3.5 cursor-help text-muted-foreground' />
            </Tooltip>
          }
        >
          <Input
            placeholder='你的平台用户 ID'
            style={{ width: PLATFORM_ID_CONTROL_WIDTH }}
            value={draft.platformUserId}
            onChange={(event) => patchDraft({ platformUserId: event.target.value })}
          />
        </AdvancedSettingRow>

        <AdvancedSettingRow icon={<Hash className='size-4' />} label='字符限制'>
          <Input
            inputMode='numeric'
            placeholder={String(DEFAULT_CHAR_LIMIT)}
            style={{ width: COMPACT_CONTROL_WIDTH }}
            value={draft.charLimit}
            onBlur={() => patchDraft({ charLimit: clampCharLimit(draft.charLimit) })}
            onChange={(event) => patchDraft({ charLimit: digitsOnly(event.target.value) })}
          />
        </AdvancedSettingRow>

        <AdvancedSettingRow icon={<ListFilter className='size-4' />} label='私信策略'>
          <AccessPolicySelect
            scope='dm'
            value={draft.dmPolicy}
            onChange={(dmPolicy) => patchDraft({ dmPolicy })}
          />
        </AdvancedSettingRow>

        <AdvancedSettingRow icon={<ListFilter className='size-4' />} label='群组策略'>
          <AccessPolicySelect
            scope='group'
            value={draft.groupPolicy}
            onChange={(groupPolicy) => patchDraft({ groupPolicy })}
          />
        </AdvancedSettingRow>

        <AdvancedSettingRow icon={<Users className='size-4' />} label='允许的用户' wide>
          <AllowedUsersEditor
            users={draft.allowedUsers}
            onAdd={addAllowedUser}
            onChange={updateAllowedUser}
            onRemove={removeAllowedUser}
          />
        </AdvancedSettingRow>
      </div>
    </Modal>
  )
})

QQAdvancedSettingsModal.displayName = 'QQAdvancedSettingsModal'

export default QQAdvancedSettingsModal
