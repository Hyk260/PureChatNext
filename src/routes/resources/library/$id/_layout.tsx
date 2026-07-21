import { type ReactNode } from 'react'

import LibrarySidebar from '@/features/resources/library/Sidebar'
import ResourcesShellLayout from '@/features/resources/ResourcesShellLayout'

export default function ResourcesLibraryLayout({ children }: { children: ReactNode }) {
  return <ResourcesShellLayout innerSidebar={<LibrarySidebar />}>{children}</ResourcesShellLayout>
}
