'use client'

import ReadFilePage from '@/features/dev/ReadFilePage'
import RequireAdmin from '@/spa/auth/RequireAdmin'

export default function SettingsReadFilePage() {
  return (
    <RequireAdmin>
      <ReadFilePage />
    </RequireAdmin>
  )
}
