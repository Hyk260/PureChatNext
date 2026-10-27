'use client'

import { TABLE_SORT_DIRECTIONS } from '@/const/table'

import { getErrorMessage } from '@pure/utils/error'

import { ActionIcon, confirmModal, toast, Select } from '@lobehub/ui'
import { Form, useForm, useWatch } from '@lobehub/ui/form'
import { ProTable } from '@lobehub/ui/pro-table'
import type { ProColumns, ProTableActionType } from '@lobehub/ui/pro-table'
import { Button, Checkbox, Flex, Input, InputPassword, Modal, SearchBar, Tag, Text } from '@pure/ui'
import { MONTHLY_FREE_CREDITS, SHANGHAI_TIMEZONE, USER_ROLE } from '@pure/const'
import type { UserRole } from '@pure/const'
import { EMPTY_PLACEHOLDER, formatCompactDateTime, formatNumber } from '@pure/utils/client'
import { Pencil, Trash2, UserPlus } from 'lucide-react'
import { useRef, useState } from 'react'
import { z } from 'zod'

import { getUserRoleLabel } from '@/const/auth'
import { useSession } from '@/libs/better-auth/client'
import {
  ADMIN_ROLE_OPTIONS,
  createAdminUser,
  deleteAdminUser,
  fetchAdminUsers,
  resetAdminUserCredits,
  updateAdminUser,
} from './users'
import type { AdminUser, AdminUserDeviceInfo, AdminUserSortBy, CreateAdminUserInput } from './users'

type UserFormMode = 'create' | 'edit'

type UserFormValues = {
  banned: boolean
  banReason?: string
  email?: string
  fullName?: string
  password?: string
  role: UserRole
  username?: string
}

const PAGE_SIZE = 20
const USER_TABLE_SORT_DIRECTIONS = [...TABLE_SORT_DIRECTIONS]
const formatUserDateTime = (value: string) => formatCompactDateTime(value, { timeZone: SHANGHAI_TIMEZONE })

const formatUserCredits = (credits: AdminUser['credits']) => {
  if (!credits) return EMPTY_PLACEHOLDER
  const percent = credits.grant <= 0 ? 0 : Math.round((credits.remaining / credits.grant) * 100)
  return `${formatNumber(credits.remaining)} / ${formatNumber(credits.grant)} · 剩余 ${percent}%`
}

const DEVICE_TYPE_LABELS: Record<AdminUserDeviceInfo['deviceType'], string> = {
  desktop: '电脑端',
  mobile: '移动端',
  tablet: '平板',
  unknown: '设备未知',
}

const formatDeviceParts = (separator: string, ...parts: Array<string | null>) => parts.filter(Boolean).join(separator)

const renderUserDeviceInfo = (deviceInfo: AdminUserDeviceInfo | null) => {
  if (!deviceInfo) return EMPTY_PLACEHOLDER

  const clientLabel =
    deviceInfo.clientType === 'electron'
      ? formatDeviceParts(' ', 'Electron', deviceInfo.appVersion)
      : formatDeviceParts(' ', deviceInfo.browser ?? 'Web 浏览器', deviceInfo.browserVersion)
  const platformLabel =
    deviceInfo.clientType === 'electron'
      ? formatDeviceParts(' · ', deviceInfo.os, deviceInfo.osVersion, deviceInfo.architecture)
      : formatDeviceParts(' · ', deviceInfo.os, deviceInfo.osVersion, DEVICE_TYPE_LABELS[deviceInfo.deviceType])

  return (
    <Flex className='min-w-0 flex-col gap-0.5'>
      <Text className='truncate'>{clientLabel}</Text>
      <Text className='truncate text-xs' type='secondary'>
        {platformLabel || DEVICE_TYPE_LABELS[deviceInfo.deviceType]}
      </Text>
    </Flex>
  )
}

const renderUserStatus = (banned: boolean) =>
  banned ? (
    <Tag color='red' size='small'>
      已封禁
    </Tag>
  ) : (
    <Tag color='green' size='small'>
      正常
    </Tag>
  )

const emptyCreateValues: UserFormValues = {
  banned: false,
  role: USER_ROLE.User,
}

const CREATE_USER_SCHEMA = z.object({
  email: z.string().trim().min(1, '请输入邮箱').email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码').min(8, '密码至少 8 个字符').max(64, '密码最多 64 个字符'),
  role: z.string().min(1, '请选择角色'),
})

const EDIT_USER_SCHEMA = z.object({
  banned: z.boolean(),
  banReason: z.string().optional(),
  fullName: z.string().optional(),
  role: z.string().min(1, '请选择角色'),
  username: z.string().trim().min(1, '请输入用户名'),
})

const INITIAL_FORM_VALUES: UserFormValues = { ...emptyCreateValues, email: '', password: '', username: '' }

const toEditValues = (user: AdminUser): UserFormValues => ({
  banned: user.banned,
  banReason: user.banReason ?? '',
  fullName: user.fullName ?? '',
  role: user.role === USER_ROLE.Admin ? USER_ROLE.Admin : USER_ROLE.User,
  username: user.username ?? '',
})

export default function AdminUsersPage() {
  const { data: session } = useSession()
  const actorId = session?.user?.id

  const form = useForm<UserFormValues>({
    initialValues: INITIAL_FORM_VALUES,
    schema: CREATE_USER_SCHEMA,
    onSubmit: (values) => handleSubmit(values),
  })
  const banned = useWatch(form, 'banned')
  const actionRef = useRef<ProTableActionType>(null)
  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [resettingCredits, setResettingCredits] = useState(false)
  const [formMode, setFormMode] = useState<UserFormMode | null>(null)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)

  const openCreate = () => {
    form.setSchema(CREATE_USER_SCHEMA)
    form.reset(INITIAL_FORM_VALUES)
    setFormMode('create')
    setEditingUser(null)
  }

  const openEdit = (user: AdminUser) => {
    form.setSchema(EDIT_USER_SCHEMA)
    form.reset({ ...INITIAL_FORM_VALUES, ...toEditValues(user) })
    setFormMode('edit')
    setEditingUser(user)
  }

  const closeForm = () => {
    setFormMode(null)
    setEditingUser(null)
    form.setSchema(CREATE_USER_SCHEMA)
    form.reset(INITIAL_FORM_VALUES)
  }

  const handleSubmit = async (values: UserFormValues) => {
    setSaving(true)
    try {
      if (formMode === 'create') {
        const input: CreateAdminUserInput = {
          email: values.email?.trim() ?? '',
          password: values.password ?? '',
          role: values.role,
        }
        const username = values.username?.trim()
        if (username) input.username = username
        await createAdminUser(input)
        toast.success('用户已创建')
        closeForm()
        await actionRef.current?.reload(true)
        return
      } else if (editingUser) {
        await updateAdminUser({
          banReason: values.banned ? values.banReason?.trim() || null : null,
          banned: values.banned,
          fullName: values.fullName?.trim() || null,
          id: editingUser.id,
          role: values.role,
          username: values.username?.trim(),
        })
        toast.success('用户已更新')
      }
      closeForm()
      await actionRef.current?.reload()
    } catch (error) {
      toast.error(getErrorMessage(error, '保存失败'))
      throw error
    } finally {
      setSaving(false)
    }
  }

  const handleResetUserCredits = () => {
    if (!editingUser || resettingCredits) return

    const target = editingUser
    const grant = target.credits?.grant ?? MONTHLY_FREE_CREDITS
    confirmModal({
      cancelText: '取消',
      content: `将清零 ${target.email ?? target.username ?? target.id} 本月已用额度，恢复为 ${formatNumber(grant)}。此操作立即生效。`,
      okText: '重置额度',
      title: '重置用户本月额度？',
      onOk: async () => {
        setResettingCredits(true)
        try {
          const credits = await resetAdminUserCredits(target.id)
          setEditingUser((current) => (current?.id === target.id ? { ...current, credits } : current))
          await actionRef.current?.reload()
          toast.success('已重置用户本月额度')
        } catch (error) {
          toast.error(getErrorMessage(error, '重置用户额度失败'))
          throw error
        } finally {
          setResettingCredits(false)
        }
      },
    })
  }

  const handleDelete = (user: AdminUser) => {
    confirmModal({
      cancelText: '取消',
      content: `将删除 ${user.email ?? user.username ?? user.id} 及其聊天、文件等关联数据，且不可恢复。`,
      okButtonProps: { danger: true },
      okText: '删除',
      onOk: async () => {
        try {
          await deleteAdminUser(user.id)
          toast.success('用户已删除')
          actionRef.current?.clearSelected()
          await actionRef.current?.reload()
        } catch (error) {
          toast.error(getErrorMessage(error, '删除失败'))
          throw error
        }
      },
      title: '删除该用户？',
    })
  }

  const columns: ProColumns<AdminUser>[] = [
    {
      dataIndex: 'email',
      ellipsis: true,
      fixed: 'left',
      title: '邮箱',
      copyable: true,
      width: 200,
    },
    {
      dataIndex: 'emailVerified',
      render: (_value, user) =>
        user.emailVerified ? (
          <Tag color='green' size='small'>
            已验证
          </Tag>
        ) : (
          <Tag color='orange' size='small'>
            未验证
          </Tag>
        ),
      title: '邮箱验证',
      width: 90,
    },
    {
      dataIndex: 'username',
      ellipsis: true,
      title: '用户名',
      width: 140,
    },
    {
      dataIndex: 'fullName',
      ellipsis: true,
      title: '全名',
      width: 120,
    },
    {
      dataIndex: 'role',
      key: 'role',
      render: (_value, user) => (
        <Tag color={user.role === USER_ROLE.Admin ? 'red' : 'blue'} size='small'>
          {getUserRoleLabel(user.role)}
        </Tag>
      ),
      sorter: true,
      title: '角色',
      width: 100,
    },
    {
      key: 'status',
      render: (_value: unknown, user) => renderUserStatus(user.banned),
      title: '状态',
      width: 90,
    },
    {
      key: 'credits',
      render: (_value: unknown, user) => formatUserCredits(user.credits),
      title: '剩余 / 总额',
      width: 240,
    },
    {
      dataIndex: 'deviceInfo',
      render: (_value, user) => renderUserDeviceInfo(user.deviceInfo),
      title: '最近设备',
      width: 220,
    },
    {
      dataIndex: 'createdAt',
      renderText: formatUserDateTime,
      title: '创建时间',
      width: 160,
    },
    {
      dataIndex: 'lastActiveAt',
      fixed: 'right',
      key: 'lastActiveAt',
      renderText: formatUserDateTime,
      sorter: true,
      title: '最近活跃',
      width: 140,
    },
    {
      key: 'actions',
      fixed: 'right',
      render: (_value: unknown, user) => {
        const isSelf = user.id === actorId
        return [
          <ActionIcon
            key='edit'
            aria-label='编辑用户'
            icon={Pencil}
            size='small'
            title='编辑用户'
            variant='filled'
            onClick={() => openEdit(user)}
          />,
          <ActionIcon
            key='delete'
            aria-label='删除用户'
            danger
            disabled={isSelf}
            icon={Trash2}
            size='small'
            title={isSelf ? '不能删除当前用户' : '删除用户'}
            variant='filled'
            onClick={() => handleDelete(user)}
          />,
        ]
      },
      title: '操作',
      valueType: 'option',
      width: 96,
    },
  ]

  const formTitle = formMode === 'create' ? '新建用户' : '编辑用户'
  const editingSelf = Boolean(editingUser && editingUser.id === actorId)

  return (
    <main className='h-full min-h-0 overflow-y-auto'>
      <Flex className='mx-auto w-full max-w-6xl flex-col gap-4 px-6 py-6'>
        <Flex className='flex-col gap-1'>
          <Text className='text-xl font-semibold'>用户管理</Text>
          <Text type='secondary'>管理员可创建、编辑、封禁和删除用户</Text>
        </Flex>

        <ProTable<AdminUser, { q: string }>
          actionRef={actionRef}
          cardBordered
          columnEmptyText={EMPTY_PLACEHOLDER}
          columns={columns}
          headerTitle={
            <SearchBar
              className='w-full'
              placeholder='搜索邮箱、用户名或全名'
              value={keyword}
              onInputChange={(value) => {
                setKeyword(value)
                if (!value) {
                  setQuery('')
                }
              }}
              onSearch={(value) => {
                setQuery(value.trim())
              }}
            />
          }
          options={{ density: true, reload: true, setting: true }}
          pagination={{
            defaultPageSize: PAGE_SIZE,
            pageSizeOptions: [10, 20, 50, 100],
            showSizeChanger: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          params={{ q: query }}
          request={async ({ current = 1, pageSize = PAGE_SIZE, q }, sort) => {
            const sortBy = Object.keys(sort).find(
              (key): key is AdminUserSortBy => key === 'role' || key === 'lastActiveAt'
            )
            const result = await fetchAdminUsers({
              page: current,
              pageSize,
              q,
              sortBy,
              sortOrder: sortBy && sort[sortBy] === 'ascend' ? 'asc' : 'desc',
            })
            return { data: result.items, success: true, total: result.total }
          }}
          rowKey='id'
          rowSelection={{}}
          scroll={{ x: 1640 }}
          search={false}
          sortDirections={USER_TABLE_SORT_DIRECTIONS}
          toolBarRender={() => [
            <ActionIcon
              key='create'
              aria-label='新建用户'
              icon={UserPlus}
              size='small'
              title='新建用户'
              variant='outlined'
              onClick={openCreate}
            />,
          ]}
          onRequestError={(error) => toast.error(error.message || '加载用户失败')}
        />
      </Flex>

      <Modal
        cancelText='取消'
        confirmLoading={saving}
        destroyOnHidden
        footer={null}
        open={formMode !== null}
        title={formTitle}
        width={440}
        onCancel={closeForm}
      >
        <Form form={form} layout='vertical'>
          {formMode === 'create' ? (
            <>
              <Form.Field label='邮箱' name='email' required>
                <Input placeholder='user@example.com' />
              </Form.Field>
              <Form.Field label='密码' name='password' required>
                <InputPassword placeholder='至少 8 位' />
              </Form.Field>
            </>
          ) : null}

          <Form.Field label='用户名' name='username' required={formMode === 'edit'}>
            <Input placeholder={formMode === 'create' ? '可留空，将自动分配' : '用户名'} />
          </Form.Field>

          {formMode === 'edit' ? (
            <Form.Field label='全名' name='fullName'>
              <Input placeholder='展示名称' />
            </Form.Field>
          ) : null}

          <Form.Field label='角色' name='role' required>
            <Select disabled={editingSelf} options={[...ADMIN_ROLE_OPTIONS]} />
          </Form.Field>

          {formMode === 'edit' ? (
            <>
              <Form.Field
                name='banned'
                render={({ onChange, value }) => (
                  <Checkbox checked={Boolean(value)} disabled={editingSelf} onChange={onChange}>
                    封禁该用户
                  </Checkbox>
                )}
              />
              {banned ? (
                <Form.Field label='封禁原因' name='banReason'>
                  <Input placeholder='可选' />
                </Form.Field>
              ) : null}
              <Flex className='flex-col gap-2 border-t border-border pt-4'>
                <Text className='font-medium'>本月额度</Text>
                <Flex className='flex-between gap-3'>
                  <Text type='secondary'>{formatUserCredits(editingUser?.credits)}</Text>
                  <Button
                    disabled={saving || resettingCredits}
                    htmlType='button'
                    loading={resettingCredits}
                    onClick={handleResetUserCredits}
                  >
                    重置额度
                  </Button>
                </Flex>
              </Flex>
            </>
          ) : null}
          <Flex className='justify-end gap-2 border-t border-border pt-4'>
            <Button htmlType='button' onClick={closeForm}>
              取消
            </Button>
            <Button htmlType='submit' loading={saving} type='primary'>
              {formMode === 'create' ? '创建' : '保存'}
            </Button>
          </Flex>
        </Form>
      </Modal>
    </main>
  )
}
