'use client'

import Link from '@/utils/link'
import { useRouter } from '@/utils/navigation'
import { formatDateTime } from '@pure/utils/client'
import { type ReactNode, useState } from 'react'

import { type UserWithoutPassword } from '@pure/database/schemas'
import { signOut } from '@/libs/better-auth/client'

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
    <div className='flex items-center justify-between gap-4 px-5 py-3.5'>
      <span className='shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground'>{label}</span>
      <span className='truncate text-right text-sm'>{value}</span>
    </div>
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
      await signOut()
      router.push('/')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <main className='min-h-screen overflow-y-auto bg-background px-6 py-8 md:px-10 md:py-12'>
      <div className='mx-auto w-full max-w-lg'>
        <div className='mb-8 flex items-center justify-between'>
          <Link
            className='inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground'
            href='/'
          >
            <span aria-hidden>←</span>
            返回首页
          </Link>
          <button
            className='rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-red-500/40 hover:text-red-500 disabled:opacity-50'
            disabled={signingOut}
            onClick={handleSignOut}
            type='button'
          >
            {signingOut ? '退出中…' : '退出登录'}
          </button>
        </div>

        <div className='mb-6 rounded-2xl border border-border bg-card p-6 shadow-xs'>
          <div className='flex items-center gap-5'>
            {user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={displayName}
                className='h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-border'
                src={user.avatar}
              />
            ) : (
              <div className='flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary/20 to-primary/5 text-xl font-semibold text-primary ring-2 ring-border'>
                {initials}
              </div>
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
          </div>
        </div>

        <div className='space-y-4'>
          <SectionCard title='账户信息'>
            <InfoRow label='用户名' value={user.username || '-'} />
            <InfoRow label='邮箱' value={user.email || '-'} />
            <InfoRow label='User ID' value={user.userId} />
            <InfoRow label='手机' value={user.phone || '未绑定'} />
            <InfoRow label='角色' value={user.role || '普通用户'} />
          </SectionCard>

          <SectionCard title='安全'>
            <div className='flex items-center justify-between gap-4 px-5 py-3.5'>
              <span className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>邮箱验证</span>
              <StatusBadge disabledLabel='未验证' enabled={Boolean(user.emailVerified)} enabledLabel='已验证' />
            </div>
            <div className='flex items-center justify-between gap-4 px-5 py-3.5'>
              <span className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>双因素认证</span>
              <StatusBadge disabledLabel='未开启' enabled={user.twoFactorEnabled ?? false} enabledLabel='已开启' />
            </div>
          </SectionCard>

          <SectionCard title='时间'>
            <InfoRow label='注册时间' value={formatDateTime(user.createdAt ?? null)} />
            <InfoRow label='最近活跃' value={formatDateTime(user.lastActiveAt ?? null)} />
          </SectionCard>
        </div>

        <div className='mt-8'>
          <button
            className='inline-flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-[filter] duration-200 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
            onClick={() => router.push('/chat')}
            type='button'
          >
            开始聊天
          </button>
        </div>
      </div>
    </main>
  )
}
