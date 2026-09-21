'use client'

import { Form, Pagination, Select, Table } from 'antd'
import type { TableProps } from 'antd'
import { ActionIcon, Block, Button, Checkbox, confirmModal, Flex, Input, InputPassword, Modal, SearchBar, Tag, Text } from '@pure/ui'
import { SHANGHAI_TIMEZONE, USER_ROLE } from '@pure/const'
import type { UserRole } from '@pure/const'
import { EMPTY_PLACEHOLDER, formatCompactDateTime } from '@pure/utils/client'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { useApp } from '@/components/AntdStaticMethods'
import { getUserRoleLabel } from '@/const/auth'
import { useSession } from '@/libs/better-auth/client'
import {
  ADMIN_ROLE_OPTIONS,
  createAdminUser,
  deleteAdminUser,
  fetchAdminUsers,
  updateAdminUser,
} from './users'
import type { AdminUser, AdminUserSortBy, CreateAdminUserInput } from './users'

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
const ANTD_SORT_ORDER = { asc: 'ascend', desc: 'descend' } as const
const TABLE_SORT_DIRECTIONS: Array<'ascend' | 'descend'> = ['descend', 'ascend', 'descend']
const formatUserDateTime = (value: string) => formatCompactDateTime(value, { timeZone: SHANGHAI_TIMEZONE })

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

const toEditValues = (user: AdminUser): UserFormValues => ({
  banned: user.banned,
  banReason: user.banReason ?? '',
  fullName: user.fullName ?? '',
  role: user.role === USER_ROLE.Admin ? USER_ROLE.Admin : USER_ROLE.User,
  username: user.username ?? '',
})

export default function AdminUsersPage() {
  const { message } = useApp()
  const navigate = useNavigate()
  const { data: session } = useSession()
  const actorId = session?.user?.id

  const goBack = () => {
    const idx = window.history.state?.idx
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1)
      return
    }
    navigate('/')
  }

  const [form] = Form.useForm<UserFormValues>()
  const banned = Form.useWatch('banned', form)
  const [items, setItems] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
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
        message.error(error instanceof Error ? error.message : '加载用户失败')
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [message, page, pageSize, query, sortBy, sortOrder]
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadUsers(controller.signal)
    return () => controller.abort()
  }, [loadUsers])

  const openCreate = () => {
    setFormMode('create')
    setEditingUser(null)
    form.setFieldsValue(emptyCreateValues)
  }

  const openEdit = (user: AdminUser) => {
    setFormMode('edit')
    setEditingUser(user)
    form.setFieldsValue(toEditValues(user))
  }

  const closeForm = () => {
    setFormMode(null)
    setEditingUser(null)
    form.resetFields()
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
        message.success('用户已创建')
        closeForm()
        if (page === 1) await loadUsers()
        else setPage(1)
        return
      } else if (editingUser) {
        await updateAdminUser({
          banReason: values.banned ? (values.banReason?.trim() || null) : null,
          banned: values.banned,
          fullName: values.fullName?.trim() || null,
          id: editingUser.id,
          role: values.role,
          username: values.username?.trim(),
        })
        message.success('用户已更新')
      }
      closeForm()
      await loadUsers()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败')
      throw error
    } finally {
      setSaving(false)
    }
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
          message.success('用户已删除')
          await loadUsers()
        } catch (error) {
          message.error(error instanceof Error ? error.message : '删除失败')
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
      render: (value: string | null) => value || EMPTY_PLACEHOLDER,
      title: '邮箱',
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
      sortOrder: sortBy === 'role' ? ANTD_SORT_ORDER[sortOrder] : null,
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
      dataIndex: 'createdAt',
      render: formatUserDateTime,
      title: '创建时间',
      width: 160,
    },
    {
      dataIndex: 'lastActiveAt',
      key: 'lastActiveAt',
      render: formatUserDateTime,
      sortOrder: sortBy === 'lastActiveAt' ? ANTD_SORT_ORDER[sortOrder] : null,
      sorter: true,
      title: '最近活跃',
      width: 160,
    },
    {
      key: 'actions',
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
    <main className='h-screen overflow-y-auto'>
      <Flex className='mx-auto w-full max-w-6xl flex-col gap-4 px-6 py-6'>
        <Flex className='flex-between gap-3 flex-wrap'>
          <Flex className='items-center gap-2'>
            <ActionIcon
              aria-label='返回上一页'
              icon={ArrowLeft}
              size='small'
              title='返回上一页'
              onClick={goBack}
            />
            <Flex className='flex-col gap-1'>
              <Text className='text-xl font-semibold'>用户管理</Text>
              <Text type='secondary'>管理员可创建、编辑、封禁和删除用户</Text>
            </Flex>
          </Flex>
          <Button type='primary' onClick={openCreate}>
            新建用户
          </Button>
        </Flex>

        <Block padding={0} variant='outlined'>
          <Flex className='gap-2.5 flex-wrap border-b border-border px-4 py-2.5'>
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
          </Flex>

          <Table<AdminUser>
            columns={columns}
            dataSource={items}
            loading={loading}
            pagination={false}
            rowKey='id'
            scroll={{ x: 1040 }}
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
        okText={formMode === 'create' ? '创建' : '保存'}
        open={formMode !== null}
        title={formTitle}
        width={440}
        onCancel={closeForm}
        onOk={() => form.validateFields().then(handleSubmit)}
      >
        <Form form={form} layout='vertical'>
          {formMode === 'create' ? (
            <>
              <Form.Item
                label='邮箱'
                name='email'
                rules={[
                  { message: '请输入邮箱', required: true },
                  { message: '请输入有效的邮箱地址', type: 'email' },
                ]}
              >
                <Input placeholder='user@example.com' />
              </Form.Item>
              <Form.Item
                label='密码'
                name='password'
                rules={[
                  { message: '请输入密码', required: true },
                  { message: '密码至少 8 个字符', min: 8 },
                  { max: 64, message: '密码最多 64 个字符' },
                ]}
              >
                <InputPassword placeholder='至少 8 位' />
              </Form.Item>
            </>
          ) : null}

          <Form.Item
            label='用户名'
            name='username'
            rules={formMode === 'create' ? [] : [{ message: '请输入用户名', required: true }]}
          >
            <Input placeholder={formMode === 'create' ? '可留空，将自动分配' : '用户名'} />
          </Form.Item>

          {formMode === 'edit' ? (
            <Form.Item label='全名' name='fullName'>
              <Input placeholder='展示名称' />
            </Form.Item>
          ) : null}

          <Form.Item label='角色' name='role' rules={[{ message: '请选择角色', required: true }]}>
            <Select disabled={editingSelf} options={[...ADMIN_ROLE_OPTIONS]} />
          </Form.Item>

          {formMode === 'edit' ? (
            <>
              <Form.Item name='banned' valuePropName='checked'>
                <Checkbox disabled={editingSelf}>封禁该用户</Checkbox>
              </Form.Item>
              {banned ? (
                <Form.Item label='封禁原因' name='banReason'>
                  <Input placeholder='可选' />
                </Form.Item>
              ) : null}
            </>
          ) : null}
        </Form>
      </Modal>
    </main>
  )
}
