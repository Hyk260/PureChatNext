'use client'

import { memo } from 'react'

import HomeSidebar from '@/features/home/HomeSidebar'

const ResourcesOuterSidebar = memo(() => {
  return <HomeSidebar />
})

ResourcesOuterSidebar.displayName = 'ResourcesOuterSidebar'

export default ResourcesOuterSidebar
