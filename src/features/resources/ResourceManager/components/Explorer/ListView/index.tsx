'use client'

import { Center, Checkbox, Flexbox, Text } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'

import FileIcon from '@/components/FileIcon'
import { DOCUMENT_FOLDER_TYPE } from '@/const/resources/fileTypes'
import { useResourceManagerStore } from '@/features/resources/store'
import type { FileListItem } from '@/types/files'

import ListViewHeader from './ListViewHeader'

const styles = createStaticStyles(({ css }) => ({
  container: css`
    cursor: pointer;
    min-width: 800px;
    transition: background 0.15s;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  evenRow: css`
    background: ${cssVar.colorFillQuaternary};

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  item: css`
    padding-block: 0;
    padding-inline: 0 24px;
    color: ${cssVar.colorTextSecondary};
  `,
  scrollContainer: css`
    overflow: auto hidden;
    flex: 1;
  `,
  selected: css`
    background: ${cssVar.colorFillTertiary};

    &:hover {
      background: ${cssVar.colorFillSecondary};
    }
  `,
}))

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatDate = (date: Date) =>
  new Date(date).toLocaleString(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

interface ListItemProps {
  index: number
  item: FileListItem
  onOpen: (item: FileListItem) => void
}

const ListItem = memo<ListItemProps>(({ index, item, onOpen }) => {
  const { columnWidths, selectedFileIds, toggleSelectFile } = useResourceManagerStore(
    useShallow((s) => ({
      columnWidths: s.columnWidths,
      selectedFileIds: s.selectedFileIds,
      toggleSelectFile: s.toggleSelectFile,
    })),
  )
  const selected = selectedFileIds.includes(item.id)
  const isFolder = item.fileType === DOCUMENT_FOLDER_TYPE

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
    <Flexbox
      align='center'
      className={[
        styles.container,
        index % 2 === 0 ? styles.evenRow : '',
        selected ? styles.selected : '',
      ]
        .filter(Boolean)
        .join(' ')}
      height={48}
      horizontal
      paddingInline={8}
      onClick={() => onOpen(item)}
    >
      <Center
        height={40}
        style={{ cursor: 'pointer', paddingInline: 4 }}
        onClick={handleCheckboxClick}
        onPointerDown={handleCheckboxPointerDown}
      >
        <Checkbox checked={selected} style={{ pointerEvents: 'none' }} />
      </Center>
      <Flexbox
        align='center'
        className={styles.item}
        gap={8}
        horizontal
        style={{
          flexShrink: 0,
          maxWidth: columnWidths.name,
          minWidth: columnWidths.name,
          paddingInline: 8,
          width: columnWidths.name,
        }}
      >
        <FileIcon fileType={item.fileType} />
        <Text ellipsis style={{ color: cssVar.colorText, flex: 1, minWidth: 0 }}>
          {item.name}
        </Text>
      </Flexbox>
      <Flexbox className={styles.item} style={{ flexShrink: 0 }} width={columnWidths.date}>
        {formatDate(item.createdAt)}
      </Flexbox>
      <Flexbox className={styles.item} style={{ flexShrink: 0 }} width={columnWidths.size}>
        {isFolder ? '-' : formatSize(item.size)}
      </Flexbox>
    </Flexbox>
  )
})

ListItem.displayName = 'ListItem'

interface ListViewProps {
  items: FileListItem[]
  onOpen: (item: FileListItem) => void
}

const ListView = memo<ListViewProps>(({ items, onOpen }) => {
  return (
    <Flexbox height='100%' width='100%'>
      <div className={styles.scrollContainer}>
        <ListViewHeader data={items} />
        <Flexbox width='100%'>
          {items.map((item, index) => (
            <ListItem key={item.id} index={index} item={item} onOpen={onOpen} />
          ))}
        </Flexbox>
      </div>
    </Flexbox>
  )
})

ListView.displayName = 'ListView'

export default ListView
