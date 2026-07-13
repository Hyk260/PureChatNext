'use client'

import { Center, Checkbox, Flexbox } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo, useCallback, type MouseEvent, type PointerEvent } from 'react'
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
    min-width: 800px;
    height: 40px;
    min-height: 40px;
    color: ${cssVar.colorTextDescription};
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    font-size: 12px;
  `,
  headerItem: css`
    height: 100%;
    padding-block: 6px;
    padding-inline: 0 24px;
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
    })),
  )
  const { handleSelectAll } = useExplorerSelectionActions(data)
  const { allSelected, indeterminate, selectedCount } = useExplorerSelectionSummary({ data })

  const handleHeaderCheckboxClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      handleSelectAll(!allSelected)
    },
    [allSelected, handleSelectAll],
  )

  const handleHeaderCheckboxPointerDown = useCallback((e: PointerEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <Flexbox align='center' className={styles.header} horizontal paddingInline={8}>
      <Center
        height={40}
        style={{ cursor: 'pointer', paddingInline: 4 }}
        onClick={handleHeaderCheckboxClick}
        onPointerDown={handleHeaderCheckboxPointerDown}
      >
        <Checkbox
          checked={allSelected}
          indeterminate={indeterminate}
          style={{ pointerEvents: 'none' }}
        />
      </Center>
      <Flexbox
        className={styles.headerItem}
        justify='center'
        style={{
          flexShrink: 0,
          maxWidth: columnWidths.name,
          minWidth: columnWidths.name,
          paddingInline: 20,
          paddingInlineEnd: 16,
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
      </Flexbox>
      <Flexbox
        className={styles.headerItem}
        justify='center'
        style={{ flexShrink: 0, paddingInlineEnd: 16, position: 'relative' }}
        width={columnWidths.date}
      >
        创建时间
        <ColumnResizeHandle
          currentWidth={columnWidths.date}
          maxWidth={300}
          minWidth={120}
          onResize={(width) => updateColumnWidth('date', width)}
        />
      </Flexbox>
      <Flexbox
        className={styles.headerItem}
        justify='center'
        style={{ flexShrink: 0, paddingInlineEnd: 16, position: 'relative' }}
        width={columnWidths.size}
      >
        大小
        <ColumnResizeHandle
          currentWidth={columnWidths.size}
          maxWidth={200}
          minWidth={80}
          onResize={(width) => updateColumnWidth('size', width)}
        />
      </Flexbox>
    </Flexbox>
  )
})

ListViewHeader.displayName = 'ListViewHeader'

export default ListViewHeader
