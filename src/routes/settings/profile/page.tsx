'use client'

import { SettingsEmptyPage } from '@/features/settings/SettingsEmptyPage'

/**
 * SSR prefetch lives in Next `app/settings/profile`; SPA client fetch lands in §4.
 * Skeleton keeps the shell navigable.
 */
export default function SettingsProfilePage() {
  return (
    <SettingsEmptyPage
      description="个人资料将在客户端拉取 session 后渲染（§4 Auth 适配）。"
      title="个人资料"
    />
  )
}
