'use client'

import { memo } from 'react'

import HomeUserTrigger from '@/features/home/components/HomeUserTrigger'
import SideBarHeaderLayout from '@/layout/SideBarHeaderLayout'

const SidebarHeader = memo(() => {
  return <SideBarHeaderLayout left={<HomeUserTrigger />} />
})

SidebarHeader.displayName = 'SidebarHeader'

export default SidebarHeader
