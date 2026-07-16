import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import AppShellLayout from '@/layout/AppShellLayout'

/**
 * Dev tools must not be reachable in production builds.
 * SPA already omits `/dev` when `import.meta.env.PROD`.
 */
export default function DevLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return <AppShellLayout>{children}</AppShellLayout>
}
