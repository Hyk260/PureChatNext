'use client'

import { useParams, usePathname } from 'next/navigation'

export const useFolderPath = () => {
  const params = useParams<{ id?: string; slug?: string[] }>()
  const pathname = usePathname()

  const libraryId = params.id
  const slugParts = params.slug ?? []
  const currentFolderSlug = slugParts.length > 0 ? slugParts[slugParts.length - 1] : null
  const folderPath = slugParts.join('/')

  const isLibraryRoute = pathname.includes('/resources/library/')

  return {
    currentFolderSlug,
    folderPath,
    isLibraryRoute,
    libraryId,
    slugParts,
  }
}
