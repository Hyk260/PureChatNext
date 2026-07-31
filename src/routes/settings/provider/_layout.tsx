import type { ReactNode } from 'react'

import ProviderShellLayout from '@/features/settings/provider/ProviderShellLayout'

export default function ProviderLayout({ children }: { children: ReactNode }) {
  return <ProviderShellLayout>{children}</ProviderShellLayout>
}
