'use client'

import { Flex } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'

import DragUploadZone from '@/components/DragUploadZone'
import { useInitFileCheck } from '@/features/resources/hooks/useInitFileCheck'
import { useResourceManagerStore } from '@/features/resources/store'
import { revalidateResources } from '@/features/resources/store/resourceStore'
import { resourceService } from '@/services/resource'
import { useFolderPath } from '@/features/resources/hooks/useFolderPath'

import FileEditor from './components/Editor'
import Explorer from './components/Explorer'
import UploadDock from './components/UploadDock'

const styles = createStaticStyles(({ css }) => ({
  container: css`
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 100%;
  `,
}))

export type ResourceManagerMode = 'editor' | 'explorer' | 'page'

const ResourceManager = memo(() => {
  useInitFileCheck()
  const { libraryId, mode } = useResourceManagerStore(
    useShallow((s) => ({ libraryId: s.libraryId, mode: s.mode })),
  )
  const { currentFolderSlug } = useFolderPath()

  const handleUploadFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        await resourceService.uploadFile(file, {
          knowledgeBaseId: libraryId,
          parentId: currentFolderSlug ?? undefined,
        })
      }
      revalidateResources()
    },
    [currentFolderSlug, libraryId],
  )

  return (
    <DragUploadZone onUploadFiles={(files) => handleUploadFiles(files)}>
      <Flex vertical className={styles.container} flex={1} style={{ height: '100%' }}>
        <Explorer />
        {mode === 'editor' && <FileEditor />}
        <UploadDock />
      </Flex>
    </DragUploadZone>
  )
})

ResourceManager.displayName = 'ResourceManager'

export default ResourceManager
