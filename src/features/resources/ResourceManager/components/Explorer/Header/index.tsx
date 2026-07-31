'use client'

import { ActionIcon, Button, confirmModal, DropdownMenu, Icon, Text, Flexbox } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import {
  ArrowDownAZ,
  CalendarIcon,
  Check,
  Grid3x3Icon,
  HardDriveIcon,
  ListIcon,
  PanelLeftOpen,
  Plus,
  Trash2Icon,
} from 'lucide-react'
import { memo, useMemo, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useHomeStore } from '@/features/home/store/useHomeStore'
import { useResourceManagerStore } from '@/features/resources/store'
import { useApp } from '@/components/AntdStaticMethods'

import ActionIconWithChevron from '../ToolBar/ActionIconWithChevron'
import SearchInput from './SearchInput'

const styles = createStaticStyles(({ css }) => ({
  header: css`
    padding: 8px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
}))

interface ExplorerHeaderProps {
  onDelete?: () => Promise<void>
  onUpload: (files: File[]) => void
  onNewFolder?: () => void
  title?: string
}

const ExplorerHeader = memo<ExplorerHeaderProps>(({ onDelete, onUpload, onNewFolder, title }) => {
  const { message } = useApp()
  const { selectedFileIds, setSorter, setViewMode, sorter, viewMode } = useResourceManagerStore(
    useShallow((s) => ({
      selectedFileIds: s.selectedFileIds,
      setSorter: s.setSorter,
      setViewMode: s.setViewMode,
      sorter: s.sorter,
      viewMode: s.viewMode,
    }))
  )
  const sidebarCollapsed = useHomeStore((s) => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useHomeStore((s) => s.toggleSidebarCollapsed)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectCount = selectedFileIds.length
  const hasSelected = selectCount > 0

  const sortOptions = useMemo(
    () => [
      { icon: ArrowDownAZ, key: 'name' as const, label: '名称' },
      {
        icon: CalendarIcon,
        key: 'createdAt' as const,
        label: '创建时间',
      },
      { icon: HardDriveIcon, key: 'size' as const, label: '大小' },
    ],
    []
  )

  const sortMenuItems = useMemo(
    () =>
      sortOptions.map((option) => ({
        extra: option.key === sorter ? <Icon icon={Check} /> : undefined,
        icon: <Icon icon={option.icon} />,
        key: option.key,
        label: option.label,
        onClick: () => setSorter(option.key),
      })),
    [setSorter, sortOptions, sorter]
  )

  const currentSortLabel = sortOptions.find((option) => option.key === sorter)?.label ?? '创建时间'

  const viewMenuItems = useMemo(
    () => [
      {
        extra: viewMode === 'list' ? <Icon icon={Check} /> : undefined,
        icon: <Icon icon={ListIcon} />,
        key: 'list',
        label: '列表',
        onClick: () => setViewMode('list'),
      },
      {
        extra: viewMode === 'masonry' ? <Icon icon={Check} /> : undefined,
        icon: <Icon icon={Grid3x3Icon} />,
        key: 'masonry',
        label: '网格',
        onClick: () => setViewMode('masonry'),
      },
    ],
    [setViewMode, viewMode]
  )

  const currentViewIcon = viewMode === 'list' ? ListIcon : Grid3x3Icon
  const currentViewLabel = viewMode === 'list' ? '列表' : '网格'

  const addMenuItems = useMemo(
    () => [
      {
        key: 'upload',
        label: '上传文件',
        onClick: () => fileInputRef.current?.click(),
      },
      ...(onNewFolder
        ? [
            {
              key: 'folder',
              label: '新建文件夹',
              onClick: onNewFolder,
            },
          ]
        : []),
    ],
    [onNewFolder]
  )

  return (
    <Flexbox horizontal align='center' className={styles.header} justify='space-between'>
      <Flexbox horizontal align='center' gap={8} style={{ overflow: 'hidden' }}>
        {sidebarCollapsed ? (
          <ActionIcon icon={PanelLeftOpen} size='small' title='展开侧栏' onClick={toggleSidebarCollapsed} />
        ) : null}
        {hasSelected ? (
          <Flexbox horizontal align='center' gap={8}>
            <ActionIcon
              icon={Trash2Icon}
              title='删除'
              onClick={() => {
                if (!onDelete) return
                confirmModal({
                  cancelText: '取消',
                  content: `确定删除选中的 ${selectCount} 个文件吗？删除后将无法恢复。`,
                  okButtonProps: { danger: true },
                  okText: '删除',
                  onOk: async () => {
                    await onDelete()
                    message.success('删除成功')
                  },
                  title: '删除',
                })
              }}
            />
          </Flexbox>
        ) : (
          <Text style={{ marginInlineStart: 8 }}>{title ?? '资源'}</Text>
        )}
      </Flexbox>
      <Flexbox horizontal align='center' gap={4}>
        <SearchInput />
        <DropdownMenu items={sortMenuItems} nativeButton>
          <ActionIconWithChevron icon={ArrowDownAZ} title={currentSortLabel} />
        </DropdownMenu>
        <DropdownMenu items={viewMenuItems} nativeButton placement='bottomRight'>
          <ActionIconWithChevron icon={currentViewIcon} title={currentViewLabel} />
        </DropdownMenu>
        <Flexbox style={{ marginInlineStart: 8 }}>
          <DropdownMenu items={addMenuItems} nativeButton placement='bottomRight'>
            <Button icon={<Plus />} type='primary'>
              添加
            </Button>
          </DropdownMenu>
        </Flexbox>
        <input
          ref={fileInputRef}
          hidden
          multiple
          type='file'
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            if (files.length) onUpload(files)
            e.target.value = ''
          }}
        />
      </Flexbox>
    </Flexbox>
  )
})

ExplorerHeader.displayName = 'ExplorerHeader'

export default ExplorerHeader
