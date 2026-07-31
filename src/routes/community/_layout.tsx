import type { ReactNode } from 'react'

import CommunityShellLayout from '@/features/community/CommunityShellLayout'

export default function CommunityLayout({ children }: { children: ReactNode }) {
  return <CommunityShellLayout>{children}</CommunityShellLayout>
}
