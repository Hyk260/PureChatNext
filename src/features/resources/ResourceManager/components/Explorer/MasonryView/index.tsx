'use client'

import { Block, Center, Checkbox, Flex, Grid, Text } from '@pure/ui'
import { formatDate } from '@pure/utils/client'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import { memo, useCallback } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'

import FileIcon from '@/components/FileIcon'
import { DOCUMENT_FOLDER_TYPE } from '@/const/resources/fileTypes'
import {
  useExplorerSelectionActions,
  useExplorerSelectionSummary,
} from '@/features/resources/hooks/useExplorerSelection'
import { useResourceManagerStore } from '@/features/resources/store'
import type { FileListItem } from '@/types/files'

const styles = createStaticStyles(({ css }) => ({
  card: css`
    cursor: pointer;
    transition: border-color 0.15s;

    &:hover {
      border-color: ${cssVar.colorPrimary};
    }
  `,
  selected: css`
    border-color: ${cssVar.colorPrimary};
    background: ${cssVar.colorPrimaryBg};
  `,
  toolbar: css`
    position: sticky;
    z-index: 1;
    inset-block-start: 0;

    padding-block: 12px;
    padding-inline: 16px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    font-size: 12px;
    color: ${cssVar.colorTextDescription};

    background: ${cssVar.colorBgContainer};
  `,
}))

interface MasonryCardProps {
  item: FileListItem
  onOpen: (item: FileListItem) => void
}

const MasonryCard = memo<MasonryCardProps>(({ item, onOpen }) => {
  const { selectedFileIds, toggleSelectFile } = useResourceManagerStore(
    useShallow((s) => ({
      selectedFileIds: s.selectedFileIds,
      toggleSelectFile: s.toggleSelectFile,
    }))
  )
  const selected = selectedFileIds.includes(item.id)
  const isFolder = item.fileType === DOCUMENT_FOLDER_TYPE
  const isImage = item.fileType.startsWith('image/')

  const handleCheckboxClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      toggleSelectFile(item.id)
    },
    [item.id, toggleSelectFile]
  )

  const handleCheckboxPointerDown = useCallback((e: PointerEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <Block
      className={cx(styles.card, selected && styles.selected)}
      padding={12}
      variant='outlined'
      onClick={() => onOpen(item)}
    >
      <Flex className='flex-col gap-2'>
        <Flex className='flex-between'>
          <Center
            height={24}
            style={{ cursor: 'pointer', paddingInline: 2 }}
            onClick={handleCheckboxClick}
            onPointerDown={handleCheckboxPointerDown}
          >
            <Checkbox checked={selected} style={{ pointerEvents: 'none' }} />
          </Center>
          <FileIcon fileName={item.name} isDirectory={isFolder} size={16} />
        </Flex>
        {isImage && item.url ? (
          <img
            alt={item.name}
            src={item.url}
            style={{ borderRadius: 8, height: 120, objectFit: 'cover', width: '100%' }}
          />
        ) : (
          <Flex className='flex-col-center h-[120px]'>
            <FileIcon fileName={item.name} isDirectory={isFolder} size={40} />
          </Flex>
        )}
        <Text ellipsis>{item.name}</Text>
        <Text type='secondary' style={{ fontSize: 12 }}>
          {isFolder ? '文件夹' : formatDate(item.updatedAt)}
        </Text>
      </Flex>
    </Block>
  )
})

MasonryCard.displayName = 'MasonryCard'

interface MasonryHeaderProps {
  data: FileListItem[]
}

const MasonryHeader = memo<MasonryHeaderProps>(({ data }) => {
  const { handleSelectAll } = useExplorerSelectionActions(data)
  const { allSelected, indeterminate, selectedCount } = useExplorerSelectionSummary({ data })

  const handleHeaderCheckboxClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      handleSelectAll(!allSelected)
    },
    [allSelected, handleSelectAll]
  )

  const handleHeaderCheckboxPointerDown = useCallback((e: PointerEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <Flex className={[styles.toolbar, 'flex-row items-center gap-2']}>
      <Center
        height={24}
        style={{ cursor: 'pointer', paddingInline: 2 }}
        onClick={handleHeaderCheckboxClick}
        onPointerDown={handleHeaderCheckboxPointerDown}
      >
        <Checkbox checked={allSelected} indeterminate={indeterminate} style={{ pointerEvents: 'none' }} />
      </Center>
      <span>{selectedCount > 0 ? `已选 ${selectedCount} 项` : `共 ${data.length} 项`}</span>
    </Flex>
  )
})

MasonryHeader.displayName = 'MasonryHeader'

interface MasonryViewProps {
  items: FileListItem[]
  onOpen: (item: FileListItem) => void
}

const MasonryView = memo<MasonryViewProps>(({ items, onOpen }) => {
  return (
    <Flex className='flex-col h-full w-full'>
      <MasonryHeader data={items} />
      <Grid gap={12} padding={16} rows={4} width='100%'>
        {items.map((item) => (
          <MasonryCard key={item.id} item={item} onOpen={onOpen} />
        ))}
      </Grid>
    </Flex>
  )
})

MasonryView.displayName = 'MasonryView'

export default MasonryView
