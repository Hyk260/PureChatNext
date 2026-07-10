'use client'

import { Block, Center, Checkbox, Flexbox, Grid, Text } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo, useCallback } from 'react'
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
    })),
  )
  const selected = selectedFileIds.includes(item.id)
  const isFolder = item.fileType === DOCUMENT_FOLDER_TYPE
  const isImage = item.fileType.startsWith('image/')

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      toggleSelectFile(item.id)
    },
    [item.id, toggleSelectFile],
  )

  const handleCheckboxPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <Block
      className={[styles.card, selected ? styles.selected : ''].filter(Boolean).join(' ')}
      padding={12}
      variant='outlined'
      onClick={() => onOpen(item)}
    >
      <Flexbox gap={8}>
        <Flexbox align='center' horizontal justify='space-between'>
          <Center
            height={24}
            style={{ cursor: 'pointer', paddingInline: 2 }}
            onClick={handleCheckboxClick}
            onPointerDown={handleCheckboxPointerDown}
          >
            <Checkbox checked={selected} style={{ pointerEvents: 'none' }} />
          </Center>
          <FileIcon fileType={item.fileType} size={16} />
        </Flexbox>
        {isImage && item.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={item.name}
            src={item.url}
            style={{ borderRadius: 8, height: 120, objectFit: 'cover', width: '100%' }}
          />
        ) : (
          <Flexbox align='center' justify='center' style={{ height: 120 }}>
            <FileIcon fileType={item.fileType} size={40} />
          </Flexbox>
        )}
        <Text ellipsis>{item.name}</Text>
        <Text fontSize={12} type='secondary'>
          {isFolder ? '文件夹' : new Date(item.updatedAt).toLocaleDateString()}
        </Text>
      </Flexbox>
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
    (e: React.MouseEvent) => {
      e.stopPropagation()
      handleSelectAll(!allSelected)
    },
    [allSelected, handleSelectAll],
  )

  const handleHeaderCheckboxPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <Flexbox align='center' className={styles.toolbar} gap={8} horizontal>
      <Center
        height={24}
        style={{ cursor: 'pointer', paddingInline: 2 }}
        onClick={handleHeaderCheckboxClick}
        onPointerDown={handleHeaderCheckboxPointerDown}
      >
        <Checkbox
          checked={allSelected}
          indeterminate={indeterminate}
          style={{ pointerEvents: 'none' }}
        />
      </Center>
      <span>{selectedCount > 0 ? `已选 ${selectedCount} 项` : `共 ${data.length} 项`}</span>
    </Flexbox>
  )
})

MasonryHeader.displayName = 'MasonryHeader'

interface MasonryViewProps {
  items: FileListItem[]
  onOpen: (item: FileListItem) => void
}

const MasonryView = memo<MasonryViewProps>(({ items, onOpen }) => {
  return (
    <Flexbox height='100%' width='100%'>
      <MasonryHeader data={items} />
      <Grid gap={12} padding={16} rows={4} width='100%'>
        {items.map((item) => (
          <MasonryCard key={item.id} item={item} onOpen={onOpen} />
        ))}
      </Grid>
    </Flexbox>
  )
})

MasonryView.displayName = 'MasonryView'

export default MasonryView
