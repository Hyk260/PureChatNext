import { Suspense } from 'react'

import Loading from '@/components/Loading/BrandTextLoading'
import ResourceHomePage from '@/features/resources/pages/ResourceHomePage'

export default function Page() {
  return (
    <Suspense fallback={<Loading debugId='Resources' />}>
      <ResourceHomePage />
    </Suspense>
  )
}
