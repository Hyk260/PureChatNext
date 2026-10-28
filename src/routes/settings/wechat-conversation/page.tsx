'use client'

import WechatConversationPage from '@/features/channel-conversation/wechat/WechatConversationPage'
import RequireAuth from '@/spa/auth/RequireAuth'

export default function SettingsWechatConversationPage() {
  return (
    <RequireAuth>
      <WechatConversationPage mode='personal' />
    </RequireAuth>
  )
}
