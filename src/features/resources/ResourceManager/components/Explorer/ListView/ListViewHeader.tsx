'use client'

import { Center, Checkbox, Flex } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo, useCallback } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'

import {
  useExplorerSelectionActions,
  useExplorerSelectionSummary,
} from '@/features/resources/hooks/useExplorerSelection'
import { useResourceManagerStore } from '@/features/resources/store'
import type { FileListItem } from '@/types/files'

import ColumnResizeHandle from './ColumnResizeHandle'

const styles = createStaticStyles(({ css }) => ({
  header: css`
    box-sizing: border-box;
    flex: none;
    min-width: 800px;
    height: 40px;
    overflow: hidden;
    color: ${cssVar.colorTextDescription};
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    font-size: 12px;
  `,
  headerItem: css`
    overflow: hidden;
    height: 100%;
    padding-block: 6px;
    padding-inline: 0 24px;
    white-space: nowrap;
  `,
}))

interface ListViewHeaderProps {
  data: FileListItem[]
}

const ListViewHeader = memo<ListViewHeaderProps>(({ data }) => {
  const { columnWidths, updateColumnWidth } = useResourceManagerStore(
    useShallow((s) => ({
      columnWidths: s.columnWidths,
      updateColumnWidth: s.updateColumnWidth,
    }))
  )
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
    <Flex className={[styles.header, 'flex-row items-center px-2']}>
      <Center
        height={40}
        style={{ cursor: 'pointer', flexShrink: 0, overflow: 'hidden', paddingInline: 4 }}
        onClick={handleHeaderCheckboxClick}
        onPointerDown={handleHeaderCheckboxPointerDown}
      >
        <Checkbox checked={allSelected} indeterminate={indeterminate} style={{ pointerEvents: 'none' }} />
      </Center>
      <Flex
        className={[styles.headerItem, 'flex-col justify-center px-5 pe-4']}

        style={{
          flexShrink: 0,
          maxWidth: columnWidths.name,
          minWidth: columnWidths.name,
          position: 'relative',
          width: columnWidths.name,
        }}
      >
        {selectedCount > 0 ? `已选 ${selectedCount} 项` : '名称'}
        <ColumnResizeHandle
          currentWidth={columnWidths.name}
          maxWidth={1200}
          minWidth={200}
          onResize={(width) => updateColumnWidth('name', width)}
        />
      </Flex>
      <Flex
        className={[styles.headerItem, 'flex-col justify-center pe-4']}

        style={{ flexShrink: 0, position: 'relative', width: columnWidths.date }}
      >
        创建时间
        <ColumnResizeHandle
          currentWidth={columnWidths.date}
          maxWidth={300}
          minWidth={150}
          onResize={(width) => updateColumnWidth('date', width)}
        />
      </Flex>
      <Flex
        className={[styles.headerItem, 'flex-col justify-center pe-4']}

        style={{ flexShrink: 0, position: 'relative', width: columnWidths.size }}
      >
        大小
      </Flex>
    </Flex>
  )
})

ListViewHeader.displayName = 'ListViewHeader'

export default ListViewHeader
