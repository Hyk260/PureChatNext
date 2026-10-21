'use client'

import { confirmModal, toast, Pagination, Select, Table } from '@lobehub/ui'
import { Form, useForm, useWatch } from '@lobehub/ui/form'
import type { TableProps } from '@lobehub/ui'
import { ActionIcon, Block, Button, Checkbox, Flex, Input, InputPassword, Modal, SearchBar, Tag, Text } from '@pure/ui'
import { MONTHLY_FREE_CREDITS, SHANGHAI_TIMEZONE, USER_ROLE } from '@pure/const'
import type { UserRole } from '@pure/const'
import { EMPTY_PLACEHOLDER, formatCompactDateTime, formatNumber } from '@pure/utils/client'
import { RefreshCw, UserPlus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
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
const SORT_ORDER = { asc: 'ascend', desc: 'descend' } as const
const TABLE_SORT_DIRECTIONS: Array<'ascend' | 'descend'> = ['descend', 'ascend', 'descend']
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
  const [items, setItems] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resettingCredits, setResettingCredits] = useState(false)
  const [formMode, setFormMode] = useState<UserFormMode | null>(null)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [sortBy, setSortBy] = useState<AdminUserSortBy>()
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const loadUsers = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      try {
        const result = await fetchAdminUsers({ page, pageSize, q: query, sortBy, sortOrder }, signal)
        setItems(result.items)
        setTotal(result.total)
      } catch (error) {
        if (signal?.aborted) return
        toast.error(error instanceof Error ? error.message : '加载用户失败')
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [page, pageSize, query, setItems, setLoading, setTotal, sortBy, sortOrder]
  )
  const refreshUsers = () => loadUsers()

  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!controller.signal.aborted) loadUsers(controller.signal)
    })
    return () => controller.abort()
  }, [loadUsers])

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
        if (page === 1) await loadUsers()
        else setPage(1)
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
      await loadUsers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
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
          setItems((current) => current.map((user) => (user.id === target.id ? { ...user, credits } : user)))
          setEditingUser((current) => (current?.id === target.id ? { ...current, credits } : current))
          toast.success('已重置用户本月额度')
        } catch (error) {
          toast.error(error instanceof Error ? error.message : '重置用户额度失败')
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
          await loadUsers()
        } catch (error) {
          toast.error(error instanceof Error ? error.message : '删除失败')
          throw error
        }
      },
      title: '删除该用户？',
    })
  }

  const columns: TableProps<AdminUser>['columns'] = [
    {
      dataIndex: 'email',
      ellipsis: true,
      fixed: 'left',
      render: (value: string | null) => value || EMPTY_PLACEHOLDER,
      title: '邮箱',
      width: 180,
    },
    {
      dataIndex: 'emailVerified',
      render: (value: boolean) =>
        value ? (
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
      render: (value: string | null) => value || EMPTY_PLACEHOLDER,
      title: '用户名',
      width: 140,
    },
    {
      dataIndex: 'fullName',
      ellipsis: true,
      fixed: 'left',
      render: (value: string | null) => value || EMPTY_PLACEHOLDER,
      title: '全名',
      width: 120,
    },
    {
      dataIndex: 'role',
      key: 'role',
      render: (value: string | null) => (
        <Tag color={value === USER_ROLE.Admin ? 'red' : 'blue'} size='small'>
          {getUserRoleLabel(value)}
        </Tag>
      ),
      sortOrder: sortBy === 'role' ? SORT_ORDER[sortOrder] : null,
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
      render: (value: AdminUserDeviceInfo | null) => renderUserDeviceInfo(value),
      title: '最近设备',
      width: 220,
    },
    {
      dataIndex: 'createdAt',
      render: formatUserDateTime,
      title: '创建时间',
      width: 160,
    },
    {
      dataIndex: 'lastActiveAt',
      fixed: 'right',
      key: 'lastActiveAt',
      render: formatUserDateTime,
      sortOrder: sortBy === 'lastActiveAt' ? SORT_ORDER[sortOrder] : null,
      sorter: true,
      title: '最近活跃',
      width: 160,
    },
    {
      key: 'actions',
      fixed: 'right',
      render: (_value: unknown, user) => {
        const isSelf = user.id === actorId
        return (
          <Flex className='gap-2'>
            <Button size='small' onClick={() => openEdit(user)}>
              编辑
            </Button>
            <Button danger disabled={isSelf} size='small' onClick={() => handleDelete(user)}>
              删除
            </Button>
          </Flex>
        )
      },
      title: '操作',
      width: 140,
    },
  ]

  const handleTableChange: TableProps<AdminUser>['onChange'] = (_pagination, _filters, sorter) => {
    const current = Array.isArray(sorter) ? sorter[0] : sorter
    const key = current?.columnKey
    if ((key !== 'role' && key !== 'lastActiveAt') || !current?.order) return
    setSortBy(key)
    setSortOrder(current.order === 'ascend' ? 'asc' : 'desc')
    setPage(1)
  }

  const formTitle = formMode === 'create' ? '新建用户' : '编辑用户'
  const editingSelf = Boolean(editingUser && editingUser.id === actorId)
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)

  return (
    <main className='h-full min-h-0 overflow-y-auto'>
      <Flex className='mx-auto w-full max-w-6xl flex-col gap-4 px-6 py-6'>
        <Flex className='flex-col gap-1'>
          <Text className='text-xl font-semibold'>用户管理</Text>
          <Text type='secondary'>管理员可创建、编辑、封禁和删除用户</Text>
        </Flex>

        <Block padding={0} variant='outlined'>
          <Flex className='flex-between gap-2.5 flex-wrap border-b border-border px-4 py-2.5'>
            <SearchBar
              placeholder='搜索邮箱、用户名或全名'
              style={{ flex: '1 1 260px' }}
              value={keyword}
              onInputChange={(value) => {
                setKeyword(value)
                if (!value) {
                  setQuery('')
                  setPage(1)
                }
              }}
              onSearch={(value) => {
                setQuery(value.trim())
                setPage(1)
              }}
            />
            <Flex className='shrink-0 gap-2'>
              <ActionIcon
                variant='outlined'
                aria-label='新建用户'
                icon={<UserPlus size={16} />}
                size='middle'
                title='新建用户'
                onClick={openCreate}
              />
              <ActionIcon
                variant='outlined'
                aria-label='刷新表格数据'
                disabled={loading}
                size='middle'
                icon={<RefreshCw size={16} className={loading ? 'animate-spin' : undefined} />}
                title='刷新表格数据'
                onClick={refreshUsers}
              />
            </Flex>
          </Flex>

          <Table<AdminUser>
            columns={columns}
            dataSource={items}
            loading={loading}
            pagination={false}
            rowKey='id'
            scroll={{ x: 1640 }}
            sortDirections={TABLE_SORT_DIRECTIONS}
            onChange={handleTableChange}
          />

          <Flex className='flex-between border-t border-border px-4 py-2.5'>
            <Text type='secondary'>
              第 {rangeStart}-{rangeEnd} 条，共 {total} 条
            </Text>
            <Pagination
              current={page}
              pageSize={pageSize}
              pageSizeOptions={[10, 20, 50, 100]}
              showSizeChanger
              size='small'
              total={total}
              onChange={(nextPage, nextPageSize) => {
                setPage(nextPageSize === pageSize ? nextPage : 1)
                setPageSize(nextPageSize)
              }}
            />
          </Flex>
        </Block>
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
