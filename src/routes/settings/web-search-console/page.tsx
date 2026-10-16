'use client'

import WebSearchPage from '@/features/admin/web-search/WebSearchPage'
import RequireAdmin from '@/spa/auth/RequireAdmin'

export default function WebSearchConsoleRoute() {
  return (
    <RequireAdmin>
      <WebSearchPage />
    </RequireAdmin>
  )
}
