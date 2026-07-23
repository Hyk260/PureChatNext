'use client'

import { Flex, Spin } from 'antd'
import { useApp } from '@/components/AntdStaticMethods'
import { memo, useCallback, useMemo } from 'react'
import { useRouter } from '@/utils/navigation'
import { useQueryState } from 'nuqs'
import { useShallow } from 'zustand/react/shallow'

import { DOCUMENT_FOLDER_TYPE } from '@/const/resources/fileTypes'
import { useFolderPath } from '@/features/resources/hooks/useFolderPath'
import { useResourceManagerUrlSync } from '@/features/resources/hooks/useResourceManagerUrlSync'
import { useResourceManagerStore } from '@/features/resources/store'
import {
  revalidateResources,
  useFetchResources,
  useResourceStore,
} from '@/features/resources/store/resourceStore'
import { resourceService } from '@/services/resource'
import { FilesTabs, type FileListItem } from '@/types/files'

const CATEGORY_TITLES: Record<FilesTabs, string> = {
  [FilesTabs.All]: '全部',
  [FilesTabs.Audios]: '音频',
  [FilesTabs.Documents]: '文档',
  [FilesTabs.Home]: '资源',
  [FilesTabs.Images]: '图片',
  [FilesTabs.Pages]: '资源',
  [FilesTabs.Videos]: '视频',
  [FilesTabs.Websites]: '资源',
}

import EmptyPlaceholder from './EmptyPlaceholder'
import ExplorerHeader from './Header'
import ListView from './ListView'
import MasonryView from './MasonryView'

const Explorer = memo(() => {
  useResourceManagerUrlSync()
  const router = useRouter()
  const { message } = useApp()
  const [, setFileParam] = useQueryState('file')
  const { currentFolderSlug, libraryId, folderPath } = useFolderPath()

  const {
    category,
    clearSelection,
    searchQuery,
    selectedFileIds,
    setCurrentViewItemId,
    setMode,
    sortType,
    sorter,
    viewMode,
  } = useResourceManagerStore(
    useShallow((s) => ({
      category: s.category,
      clearSelection: s.clearSelection,
      searchQuery: s.searchQuery,
      selectedFileIds: s.selectedFileIds,
      setCurrentViewItemId: s.setCurrentViewItemId,
      setMode: s.setMode,
      sortType: s.sortType,
      sorter: s.sorter,
      viewMode: s.viewMode,
    })),
  )

  const queryParams = useMemo(
    () => ({
      category: libraryId ? undefined : category,
      knowledgeBaseId: libraryId,
      parentId: currentFolderSlug || null,
      q: searchQuery,
      showFilesInKnowledgeBase: false,
      sortType,
      sorter,
    }),
    [category, libraryId, currentFolderSlug, searchQuery, sortType, sorter],
  )

  const { isLoading } = useFetchResources(queryParams)
  const resourceList = useResourceStore((s) => s.resourceList)

  const handleUpload = useCallback(async (files: File[]) => {
    for (const file of files) {
      try {
        await resourceService.uploadFile(file, {
          knowledgeBaseId: libraryId,
          parentId: currentFolderSlug ?? undefined,
        })
      } catch (err) {
        message.error(err instanceof Error ? err.message : '上传失败')
      }
    }
    revalidateResources()
    message.success('上传完成')
  }, [currentFolderSlug, libraryId, message])

  const handleOpen = useCallback(
    (item: FileListItem) => {
      if (item.fileType === DOCUMENT_FOLDER_TYPE && libraryId) {
        const slug = item.slug ?? item.id
        const nextPath = folderPath ? `${folderPath}/${slug}` : slug
        router.push(`/resources/library/${libraryId}/${nextPath}`)
        return
      }
      setFileParam(item.id)
      setCurrentViewItemId(item.id)
      setMode('editor')
    },
    [folderPath, libraryId, router, setCurrentViewItemId, setFileParam, setMode],
  )

  const handleNewFolder = useCallback(async () => {
    const name = window.prompt('文件夹名称')
    if (!name) return
    try {
      await resourceService.createFolder({
        knowledgeBaseId: libraryId,
        name,
        parentId: currentFolderSlug,
      })
      revalidateResources()
      message.success('文件夹已创建')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '创建失败')
    }
  }, [currentFolderSlug, libraryId, message])

  const handleBatchDelete = useCallback(async () => {
    if (selectedFileIds.length === 0) return
    const items = resourceList
      .filter((item) => selectedFileIds.includes(item.id))
      .map((item) => ({
        id: item.id,
        sourceType: (item.sourceType === 'document' ? 'document' : 'file') as 'file' | 'document',
      }))
    if (items.length === 0) return
    try {
      await useResourceStore.getState().batchDelete(items)
      clearSelection()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败')
      throw err
    }
  }, [clearSelection, message, resourceList, selectedFileIds])

  return (
    <Flex vertical flex={1} style={{ height: '100%', width: '100%' }}>
      <ExplorerHeader
        title={libraryId ? undefined : CATEGORY_TITLES[category]}
        onDelete={handleBatchDelete}
        onNewFolder={libraryId ? handleNewFolder : undefined}
        onUpload={(files) => handleUpload(files)}
      />
      <Flex vertical flex={1} style={{ overflow: 'auto' }}>
        {isLoading ? (
          <Flex vertical align='center' flex={1} justify='center'>
            <Spin />
          </Flex>
        ) : resourceList.length === 0 ? (
          <EmptyPlaceholder onUpload={handleUpload} />
        ) : viewMode === 'masonry' ? (
          <MasonryView items={resourceList} onOpen={handleOpen} />
        ) : (
          <ListView items={resourceList} onOpen={handleOpen} />
        )}
      </Flex>
    </Flex>
  )
})

Explorer.displayName = 'Explorer'

export default Explorer
