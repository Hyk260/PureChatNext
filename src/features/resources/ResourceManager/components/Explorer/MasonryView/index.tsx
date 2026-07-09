'use client'

import { Block, Checkbox, Flexbox, Grid, Text } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo } from 'react'
import { useShallow } from 'zustand/react/shallow'

import FileIcon from '@/components/FileIcon'
import { DOCUMENT_FOLDER_TYPE } from '@/const/resources/fileTypes'
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

  return (
    <Block
      className={[styles.card, selected ? styles.selected : ''].join(' ')}
      padding={12}
      variant='outlined'
      onClick={() => onOpen(item)}
    >
      <Flexbox gap={8}>
        <Flexbox align='center' horizontal justify='space-between'>
          <Checkbox
            checked={selected}
            onClick={(e) => e.stopPropagation()}
            onChange={() => toggleSelectFile(item.id)}
          />
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

interface MasonryViewProps {
  items: FileListItem[]
  onOpen: (item: FileListItem) => void
}

const MasonryView = memo<MasonryViewProps>(({ items, onOpen }) => {
  return (
    <Grid gap={12} padding={16} rows={4} width='100%'>
      {items.map((item) => (
        <MasonryCard key={item.id} item={item} onOpen={onOpen} />
      ))}
    </Grid>
  )
})

MasonryView.displayName = 'MasonryView'

export default MasonryView
