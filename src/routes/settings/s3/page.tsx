'use client'

import S3Page from '@/features/dev/S3Page'
import RequireAdmin from '@/spa/auth/RequireAdmin'

export default function SettingsS3Page() {
  return (
    <RequireAdmin>
      <S3Page />
    </RequireAdmin>
  )
}
