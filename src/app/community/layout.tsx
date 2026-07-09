import type { ReactNode } from 'react'

import CommunityShellLayout from '@/features/community/CommunityShellLayout'
import AppShellLayout from '@/layout/AppShellLayout'

const CommunityLayout = ({ children }: { children: ReactNode }) => {
  return (
    <AppShellLayout>
      <CommunityShellLayout>{children}</CommunityShellLayout>
    </AppShellLayout>
  )
}

export default CommunityLayout
