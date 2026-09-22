'use client'

import WebSearchPage from '@/features/dev/WebSearchPage'
import RequireAdmin from '@/spa/auth/RequireAdmin'

export default function SettingsWebSearchPage() {
  return (
    <RequireAdmin>
      <WebSearchPage />
    </RequireAdmin>
  )
}
