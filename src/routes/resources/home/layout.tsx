'use client'

import type { ReactNode } from 'react'

import { useHomeStore } from '@/features/home/store/useHomeStore'
import HomeSidebar from '@/features/resources/home/Sidebar'
import ResourcesShellLayout from '@/features/resources/ResourcesShellLayout'

export default function ResourcesHomeLayout({ children }: { children: ReactNode }) {
  const sidebarCollapsed = useHomeStore((state) => state.sidebarCollapsed)

  return (
    <ResourcesShellLayout innerSidebar={<HomeSidebar />} sidebarCollapsible sidebarCollapsed={sidebarCollapsed}>
      {children}
    </ResourcesShellLayout>
  )
}
