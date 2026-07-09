import type { ReactNode } from 'react'

import AppShellLayout from '@/layout/AppShellLayout'
import DndContextWrapper from '@/features/resources/DndContextWrapper'

const ResourcesRootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <AppShellLayout>
      <DndContextWrapper>{children}</DndContextWrapper>
    </AppShellLayout>
  )
}

export default ResourcesRootLayout
