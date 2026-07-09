import type { ReactNode } from 'react'

import ResourcesShellLayout from '@/features/resources/ResourcesShellLayout'
import LibrarySidebar from '@/features/resources/library/Sidebar'

const ResourcesLibraryLayout = ({ children }: { children: ReactNode }) => {
  return <ResourcesShellLayout innerSidebar={<LibrarySidebar />}>{children}</ResourcesShellLayout>
}

export default ResourcesLibraryLayout
