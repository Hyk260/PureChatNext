'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from '@/utils/navigation'
import { useShallow } from 'zustand/react/shallow'

import ResourceManager from '@/features/resources/ResourceManager'
import { useResourceManagerStore } from '@/features/resources/store'
import { FilesTabs } from '@/types/files'

const ResourceHomePage = () => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const categoryParam = (searchParams.get('category') as FilesTabs) || FilesTabs.All
  const { setCategory, setLibraryId } = useResourceManagerStore(
    useShallow((s) => ({ setCategory: s.setCategory, setLibraryId: s.setLibraryId }))
  )

  useEffect(() => {
    const isOnHomeRoute = pathname === '/resources' || !pathname.includes('/library/')
    if (isOnHomeRoute) {
      setLibraryId(undefined)
      setCategory(categoryParam)
    }
  }, [categoryParam, pathname, setCategory, setLibraryId])

  return <ResourceManager />
}

export default ResourceHomePage
