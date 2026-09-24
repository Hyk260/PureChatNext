'use client'

import QqConversationPage from '@/features/admin/qq-conversation/QqConversationPage'
import RequireAdmin from '@/spa/auth/RequireAdmin'

export default function SettingsQqConversationPage() {
  return (
    <RequireAdmin>
      <QqConversationPage />
    </RequireAdmin>
  )
}
