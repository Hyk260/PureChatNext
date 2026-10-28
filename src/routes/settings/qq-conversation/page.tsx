'use client'

import QqConversationPage from '@/features/channel-conversation/qq/QqConversationPage'
import RequireAuth from '@/spa/auth/RequireAuth'

export default function SettingsQqConversationPage() {
  return (
    <RequireAuth>
      <QqConversationPage mode='personal' />
    </RequireAuth>
  )
}
