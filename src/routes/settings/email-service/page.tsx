'use client'

import EmailServicePage from '@/features/dev/EmailServicePage'
import RequireAdmin from '@/spa/auth/RequireAdmin'

export default function SettingsEmailServicePage() {
  return (
    <RequireAdmin>
      <EmailServicePage />
    </RequireAdmin>
  )
}
