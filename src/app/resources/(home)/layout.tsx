import type { ReactNode } from 'react'

import ResourcesShellLayout from '@/features/resources/ResourcesShellLayout'
import HomeSidebar from '@/features/resources/home/Sidebar'

const ResourcesHomeLayout = ({ children }: { children: ReactNode }) => {
  return <ResourcesShellLayout innerSidebar={<HomeSidebar />}>{children}</ResourcesShellLayout>
}

export default ResourcesHomeLayout
