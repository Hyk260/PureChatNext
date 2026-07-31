import type { ReactNode } from 'react'

import DndContextWrapper from '@/features/resources/DndContextWrapper'

export default function ResourcesRootLayout({ children }: { children: ReactNode }) {
  return <DndContextWrapper>{children}</DndContextWrapper>
}
