'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'

import ResourceManager from '@/features/resources/ResourceManager'
import { useResourceManagerStore } from '@/features/resources/store'
import { useFetchKnowledgeBaseList } from '@/features/resources/store/resourceStore'

const ResourceLibraryPage = () => {
  const params = useParams<{ id: string }>()
  const setLibraryId = useResourceManagerStore((s) => s.setLibraryId)
  useFetchKnowledgeBaseList()

  useEffect(() => {
    setLibraryId(params.id)
  }, [params.id, setLibraryId])

  return <ResourceManager />
}

export default ResourceLibraryPage
