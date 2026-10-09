'use client'

import { Button, Flex, Text } from '@pure/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDateTime } from '@pure/utils/client'
import { useState } from 'react'
import type { ReactNode } from 'react'

import type { UserWithoutPassword } from '@pure/database/schemas'
import { getUserRoleLabel } from '@/const/auth'
import { signOutWorkspace } from '@/features/auth/signOutWorkspace'

type DateKeys = 'accessedAt' | 'banExpires' | 'createdAt' | 'emailVerifiedAt' | 'lastActiveAt' | 'updatedAt'

export type ProfileUser = {
  [K in keyof UserWithoutPassword]: K extends DateKeys ? string | null : UserWithoutPassword[K]
}

interface ProfileContentProps {
  user: ProfileUser
}

function StatusBadge({
  enabled,
  enabledLabel,
  disabledLabel,
}: {
  disabledLabel: string
  enabled: boolean
  enabledLabel: string
}) {
  return (
    <span
      className={
        enabled
          ? 'inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary'
          : 'inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground'
      }
    >
      {enabled ? enabledLabel : disabledLabel}
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Flex className='flex-between gap-4 px-5 py-3.5'>
      <Text as='span' fontSize={12} weight={500} type='secondary' className='shrink-0 uppercase tracking-wide'>
        {label}
      </Text>
      <Text as='span' fontSize={14} className='truncate text-right'>
        {value}
      </Text>
    </Flex>
  )
}

function SectionCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className='rounded-2xl border border-border bg-card shadow-xs'>
      <h2 className='border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground'>
        {title}
      </h2>
      <div className='divide-y divide-border'>{children}</div>
    </section>
  )
}

export function ProfileContent({ user }: ProfileContentProps) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const displayName = user.username || user.userId
  const initials =
    user.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || user.userId[0]?.toUpperCase() || '?'

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOutWorkspace()
      router.replace('/signin')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <main className='min-h-screen overflow-y-auto bg-background px-6 py-8 md:px-10 md:py-12'>
      <div className='mx-auto w-full max-w-lg'>
        <Flex className='flex-between mb-8'>
          <Link
            className='inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground'
            href='/'
          >
            <span aria-hidden>←</span>
            返回首页
          </Link>
          <Button danger shape='round' disabled={signingOut} loading={signingOut} onClick={handleSignOut}>
            {signingOut ? '退出中…' : '退出登录'}
          </Button>
        </Flex>

        <div className='mb-6 rounded-2xl border border-border bg-card p-6 shadow-xs'>
          <Flex className='items-center gap-5'>
            {user.avatar ? (
              <img
                alt={displayName}
                className='h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-border'
                src={user.avatar}
              />
            ) : (
              <Flex className='flex-center h-16 w-16 shrink-0 rounded-full bg-linear-to-br from-primary/20 to-primary/5 text-xl font-semibold text-primary ring-2 ring-border'>
                {initials}
              </Flex>
            )}
            <div className='min-w-0'>
              <h1 className='truncate text-xl font-semibold tracking-tight'>{displayName}</h1>
              <p className='mt-0.5 truncate text-sm text-muted-foreground'>{user.email || '未绑定邮箱'}</p>
              <div className='mt-2'>
                <StatusBadge
                  disabledLabel='邮箱未验证'
                  enabled={Boolean(user.emailVerified)}
                  enabledLabel='邮箱已验证'
                />
              </div>
            </div>
          </Flex>
        </div>

        <div className='space-y-4'>
          <SectionCard title='账户信息'>
            <InfoRow label='用户名' value={user.username || '-'} />
            <InfoRow label='邮箱' value={user.email || '-'} />
            <InfoRow label='User ID' value={user.userId} />
            <InfoRow label='手机' value={user.phone || '未绑定'} />
            <InfoRow label='角色' value={getUserRoleLabel(user.role)} />
          </SectionCard>

          <SectionCard title='安全'>
            <Flex className='flex-between gap-4 px-5 py-3.5'>
              <span className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>邮箱验证</span>
              <StatusBadge disabledLabel='未验证' enabled={Boolean(user.emailVerified)} enabledLabel='已验证' />
            </Flex>
            <Flex className='flex-between gap-4 px-5 py-3.5'>
              <span className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>双因素认证</span>
              <StatusBadge disabledLabel='未开启' enabled={user.twoFactorEnabled ?? false} enabledLabel='已开启' />
            </Flex>
          </SectionCard>

          <SectionCard title='时间'>
            <InfoRow label='注册时间' value={formatDateTime(user.createdAt ?? null)} />
            <InfoRow label='最近活跃' value={formatDateTime(user.lastActiveAt ?? null)} />
          </SectionCard>
        </div>

        <div className='mt-8'>
          <Button block size='large' shape='round' onClick={() => router.push('/chat')} type='primary'>
            开始聊天
          </Button>
        </div>
      </div>
    </main>
  )
}
