'use client'

import { Navigate, useParams } from 'react-router'

import ProviderDetailPage from '@/features/settings/provider/ProviderDetailPage'
import { isSettingsProviderId } from '@/features/settings/provider/const'

export default function Page() {
  const { id } = useParams<{ id: string }>()

  if (!id || !isSettingsProviderId(id)) {
    return <Navigate replace to="/settings/provider/all" />
  }

  return <ProviderDetailPage id={id} />
}
