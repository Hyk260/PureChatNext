'use client'

import AdminUsersPage from '@/features/admin/UsersPage'
import RequireAdmin from '@/spa/auth/RequireAdmin'

export default function SettingsUsersPage() {
  return (
    <RequireAdmin>
      <AdminUsersPage />
    </RequireAdmin>
  )
}
