'use client'

import WechatConversationPage from '@/features/admin/wechat-conversation/WechatConversationPage'
import RequireAdmin from '@/spa/auth/RequireAdmin'

export default function SettingsWechatConversationPage() {
  return (
    <RequireAdmin>
      <WechatConversationPage />
    </RequireAdmin>
  )
}
