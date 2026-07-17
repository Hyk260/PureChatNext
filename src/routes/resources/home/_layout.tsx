import type { ReactNode } from 'react'

import HomeSidebar from '@/features/resources/home/Sidebar'
import ResourcesShellLayout from '@/features/resources/ResourcesShellLayout'

export default function ResourcesHomeLayout({ children }: { children: ReactNode }) {
  return <ResourcesShellLayout innerSidebar={<HomeSidebar />}>{children}</ResourcesShellLayout>
}
