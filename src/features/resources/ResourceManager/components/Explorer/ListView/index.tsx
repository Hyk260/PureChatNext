'use client'

import { Checkbox } from 'antd'
import { Center, Text, Flexbox } from '@pure/ui'
import { formatDateTime, formatSize } from '@pure/utils/client'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo, useCallback } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
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
    }))
  )
  const selected = selectedFileIds.includes(item.id)
  const isFolder = item.fileType === DOCUMENT_FOLDER_TYPE

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
    <Flexbox
      horizontal
      align='center'
      className={[styles.container, index % 2 === 0 ? styles.evenRow : '', selected ? styles.selected : '']
        .filter(Boolean)
        .join(' ')}
      onClick={() => onOpen(item)}
      style={{ height: 48, paddingInline: 8 }}
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
        horizontal
        align='center'
        className={styles.item}
        gap={8}
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
      <Flexbox className={styles.item} style={{ flexShrink: 0, width: columnWidths.date }}>
        {formatDateTime(item.createdAt)}
      </Flexbox>
      <Flexbox className={styles.item} style={{ flexShrink: 0, width: columnWidths.size }}>
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
    <Flexbox style={{ height: '100%', width: '100%' }}>
      <div className={styles.scrollContainer}>
        <ListViewHeader data={items} />
        <Flexbox style={{ width: '100%' }}>
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
