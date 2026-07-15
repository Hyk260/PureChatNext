import { notFound } from 'next/navigation'

import ProviderDetailPage from '@/features/settings/provider/ProviderDetailPage'
import { isSettingsProviderId } from '@/features/settings/provider/const'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  if (!isSettingsProviderId(id)) {
    notFound()
  }

  return <ProviderDetailPage id={id} />
}
