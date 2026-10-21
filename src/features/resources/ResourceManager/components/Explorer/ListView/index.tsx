'use client'

import { Center, Checkbox, Flex, Text } from '@pure/ui'
import { formatDateTime, formatSize } from '@pure/utils/client'
import { createStaticStyles, cssVar, cx } from '@lobehub/ui'
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
  // 保留 createStaticStyles：依赖尚无对应 Tailwind 语义 token 的主题或运行时变量。
  item: css`
    color: ${cssVar.colorTextSecondary};
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
    <Flex
      className={[
        styles.container,
        index % 2 === 0 && styles.evenRow,
        selected && styles.selected,
        'items-center h-[48px] px-2',
      ]}
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
      <Flex
        className={[cx(styles.item, 'ps-0 pe-6 py-0'), 'shrink-0 items-center gap-2 px-2']}
        style={{ maxWidth: columnWidths.name, minWidth: columnWidths.name, width: columnWidths.name }}
      >
        <FileIcon fileName={item.name} isDirectory={isFolder} size={24} />
        <Text className='min-w-0 flex-1' ellipsis>
          {item.name}
        </Text>
      </Flex>
      <Flex className={[cx(styles.item, 'ps-0 pe-6 py-0'), 'shrink-0 flex-col']} style={{ width: columnWidths.date }}>
        {formatDateTime(item.createdAt)}
      </Flex>
      <Flex className={[cx(styles.item, 'ps-0 pe-6 py-0'), 'shrink-0 flex-col']} style={{ width: columnWidths.size }}>
        {isFolder ? '-' : formatSize(item.size)}
      </Flex>
    </Flex>
  )
})

ListItem.displayName = 'ListItem'

interface ListViewProps {
  items: FileListItem[]
  onOpen: (item: FileListItem) => void
}

const ListView = memo<ListViewProps>(({ items, onOpen }) => {
  return (
    <Flex className='flex-col size-full'>
      <div className={'overflow-x-auto overflow-y-hidden flex-1'}>
        <ListViewHeader data={items} />
        <Flex className='flex-col w-full'>
          {items.map((item, index) => (
            <ListItem key={item.id} index={index} item={item} onOpen={onOpen} />
          ))}
        </Flex>
      </div>
    </Flex>
  )
})

ListView.displayName = 'ListView'

export default ListView
