'use client'

import EmailServicePage from '@/features/admin/email-service/EmailServicePage'
import RequireAdmin from '@/spa/auth/RequireAdmin'

export default function SettingsEmailServicePage() {
  return (
    <RequireAdmin>
      <EmailServicePage />
    </RequireAdmin>
  )
}
