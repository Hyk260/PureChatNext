'use client'

import { useParams, usePathname } from '@/utils/navigation'

/** Next catch-all `slug` is string[]; react-router splat is `params['*']`. */
function resolveSlugParts(params: {
  slug?: string | string[]
  '*'?: string
}): string[] {
  if (Array.isArray(params.slug)) return params.slug
  if (typeof params.slug === 'string' && params.slug) {
    return params.slug.split('/').filter(Boolean)
  }
  if (params['*']) return params['*'].split('/').filter(Boolean)
  return []
}

export const useFolderPath = () => {
  const params = useParams<{ id?: string; slug?: string | string[]; '*'?: string }>()
  const pathname = usePathname()

  const libraryId = params.id
  const slugParts = resolveSlugParts(params)
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
