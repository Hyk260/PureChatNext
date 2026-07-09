'use client'

import { createContext, memo, use, useMemo, useState, type ReactNode } from 'react'

import ConfigGroupModal from '@/features/home/HomeSidebar/modals/ConfigGroupModal'

interface SidebarModalContextValue {
  openConfigGroupModal: () => void
}

const SidebarModalContext = createContext<SidebarModalContextValue | null>(null)

export const useSidebarModal = () => {
  const context = use(SidebarModalContext)
  if (!context) {
    throw new Error('useSidebarModal must be used within SidebarModalProvider')
  }
  return context
}

interface SidebarModalProviderProps {
  children: ReactNode
}

export const SidebarModalProvider = memo<SidebarModalProviderProps>(({ children }) => {
  const [configGroupModalOpen, setConfigGroupModalOpen] = useState(false)

  const contextValue = useMemo<SidebarModalContextValue>(
    () => ({
      openConfigGroupModal: () => setConfigGroupModalOpen(true),
    }),
    [],
  )

  return (
    <SidebarModalContext value={contextValue}>
      {children}
      <ConfigGroupModal
        open={configGroupModalOpen}
        onCancel={() => setConfigGroupModalOpen(false)}
      />
    </SidebarModalContext>
  )
})

SidebarModalProvider.displayName = 'SidebarModalProvider'
