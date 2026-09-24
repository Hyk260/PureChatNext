'use client'

import { ActionIcon, Button, Flex, Input, Modal, Select, Text, Tooltip } from '@pure/ui'
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

import { useApp } from '@/components/AntdStaticMethods'

import type { QQAccessPolicy, QQAdvancedSettings } from './qqApi'
import { updateQQAdvancedSettings } from './qqApi'
import {
  QQ_DEFAULT_CHAR_LIMIT,
  QQ_MIN_CHAR_LIMIT,
  QQ_PLATFORM_MAX_TEXT_LENGTH,
} from '@/libs/channels/qq/advancedSettings'

type AccessPolicyScope = 'dm' | 'group'

type AllowedUser = {
  id: string
  platformUserId: string
  remark: string
}

type AdvancedSettingsDraft = {
  allowedUsers: AllowedUser[]
  charLimit: string
  dmPolicy: QQAccessPolicy
  groupPolicy: QQAccessPolicy
  platformUserId: string
}

const ACCESS_POLICY_META: Record<
  QQAccessPolicy,
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
      dm: '拒绝所有私信（含自己）',
      group: '拒绝所有群消息',
    },
    label: '禁用',
  },
}

const ACCESS_POLICY_VALUES = ['open', 'allowlist', 'disabled'] as const satisfies QQAccessPolicy[]

const COMPACT_CONTROL_WIDTH = 140
const PLATFORM_ID_CONTROL_WIDTH = 280

function createDefaultDraft(): AdvancedSettingsDraft {
  return {
    allowedUsers: [],
    charLimit: String(QQ_DEFAULT_CHAR_LIMIT),
    dmPolicy: 'open',
    groupPolicy: 'open',
    platformUserId: '',
  }
}

function digitsOnly(raw: string) {
  return raw.replace(/\D/g, '')
}

function clampCharLimit(raw: string): string {
  const digits = digitsOnly(raw)
  if (!digits) return String(QQ_DEFAULT_CHAR_LIMIT)
  const value = Number(digits)
  if (!Number.isFinite(value) || value < QQ_MIN_CHAR_LIMIT) return String(QQ_MIN_CHAR_LIMIT)
  if (value > QQ_PLATFORM_MAX_TEXT_LENGTH) return String(QQ_PLATFORM_MAX_TEXT_LENGTH)
  return String(value)
}

function createAllowedUser(seed?: { platformUserId?: string; remark?: string }): AllowedUser {
  return {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    platformUserId: seed?.platformUserId ?? '',
    remark: seed?.remark ?? '',
  }
}

function settingsToDraft(settings?: QQAdvancedSettings | null): AdvancedSettingsDraft {
  if (!settings) return createDefaultDraft()
  return {
    allowedUsers: settings.allowedUsers.map((user) =>
      createAllowedUser({ platformUserId: user.platformUserId, remark: user.remark })
    ),
    charLimit: String(settings.charLimit || QQ_DEFAULT_CHAR_LIMIT),
    dmPolicy: settings.dmPolicy,
    groupPolicy: settings.groupPolicy,
    platformUserId: settings.platformUserId,
  }
}

function draftToSettings(draft: AdvancedSettingsDraft): QQAdvancedSettings {
  return {
    allowedUsers: draft.allowedUsers
      .map((user) => ({
        platformUserId: user.platformUserId.trim(),
        ...(user.remark.trim() ? { remark: user.remark.trim() } : {}),
      }))
      .filter((user) => user.platformUserId),
    charLimit: Number(clampCharLimit(draft.charLimit)),
    dmPolicy: draft.dmPolicy,
    groupPolicy: draft.groupPolicy,
    platformUserId: draft.platformUserId.trim(),
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
  onChange: (value: QQAccessPolicy) => void
  scope: AccessPolicyScope
  value: QQAccessPolicy
}) {
  return (
    <Select
      optionRender={(option) => {
        const policy = option.value as QQAccessPolicy
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
        if (typeof next === 'string') onChange(next as QQAccessPolicy)
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
          尚未添加任何用户——任何人都可以与机器人交互（受策略约束）。
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
          <ActionIcon icon={Trash2} size='small' title='移除用户' onClick={() => onRemove(user.id)} />
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
  initialSettings?: QQAdvancedSettings | null
  onClose: () => void
  onSaved: (settings: QQAdvancedSettings) => void
  open: boolean
}

const QQAdvancedSettingsModal = memo<QQAdvancedSettingsModalProps>(
  ({ initialSettings, onClose, onSaved, open }) => {
    const { message } = useApp()
    const [draft, setDraft] = useState<AdvancedSettingsDraft>(() => settingsToDraft(initialSettings))
    const [saving, setSaving] = useState(false)

    const resetDefaults = useCallback(() => {
      setDraft(createDefaultDraft())
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

    const settingsReady = Boolean(initialSettings)
    const handleSave = useCallback(async () => {
      if (!settingsReady) {
        message.warning('设置尚未加载，请稍后再试')
        return
      }
      const blankRows = draft.allowedUsers.filter((user) => !user.platformUserId.trim())
      if (blankRows.length > 0) {
        message.warning('请填写白名单用户的平台用户 ID，或移除空行')
        return
      }
      setSaving(true)
      try {
        const next = await updateQQAdvancedSettings(draftToSettings(draft))
        message.success('已保存高级设置')
        onSaved(next)
        onClose()
      } catch (error) {
        message.error(error instanceof Error ? error.message : '保存失败')
      } finally {
        setSaving(false)
      }
    }, [draft, message, onClose, onSaved, settingsReady])

    return (
      <Modal
        cancelButtonProps={{ disabled: saving }}
        cancelText='取消'
        confirmLoading={saving}
        destroyOnHidden
        keyboard={!saving}
        maskClosable={!saving}
        okButtonProps={{ disabled: !settingsReady || saving }}
        okText='保存'
        open={open}
        title='高级设置'
        width={720}
        onCancel={onClose}
        onOk={() => void handleSave()}
      >
        <Flex className='mb-3 items-center justify-end'>
          <Button disabled={saving} icon={<RotateCcw size={14} />} size='small' onClick={resetDefaults}>
            恢复默认配置
          </Button>
        </Flex>

        <div className='px-0.5'>
          <AdvancedSettingRow
            icon={<ScanFace className='size-4' />}
            label='你的平台用户 ID'
            labelExtra={
              <Tooltip title='填写 QQ OpenAPI 事件中的 tiny_id（不是 QQ 号）。先私信机器人一次，再从入站日志/事件中复制；用于白名单防锁定。'>
                <CircleHelp className='size-3.5 cursor-help text-muted-foreground' />
              </Tooltip>
            }
          >
            <Input
              placeholder='QQ tiny_id'
              style={{ width: PLATFORM_ID_CONTROL_WIDTH }}
              value={draft.platformUserId}
              onChange={(event) => patchDraft({ platformUserId: event.target.value })}
            />
          </AdvancedSettingRow>

          <AdvancedSettingRow
            icon={<Hash className='size-4' />}
            label='字符限制'
            labelExtra={
              <Tooltip title='单条出站消息的分片长度（最大 2000）。超长回复会拆成多条发送，被动回复窗口最多 5 条。'>
                <CircleHelp className='size-3.5 cursor-help text-muted-foreground' />
              </Tooltip>
            }
          >
            <Input
              inputMode='numeric'
              placeholder={String(QQ_DEFAULT_CHAR_LIMIT)}
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
  }
)

QQAdvancedSettingsModal.displayName = 'QQAdvancedSettingsModal'

export default QQAdvancedSettingsModal
