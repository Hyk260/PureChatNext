'use client'

import { ActionIcon, DropdownMenu, Flex, SearchBar, Text } from '@pure/ui'
import type { MenuProps } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { Activity, CircleX, Ellipsis, Plus, RefreshCcwDot, RotateCcw, X } from 'lucide-react'
import { memo, useMemo } from 'react'

interface ModelTitleProps {
  canClearRemoteModels?: boolean
  loading: boolean
  healthLoading?: boolean
  healthModelCount?: number
  onAddCustomModel?: () => void
  onCancelHealthCheck?: () => void
  onClearRemoteModels?: () => void
  onHealthCheck?: () => void
  onFetch?: () => void
  onKeywordChange: (keyword: string) => void
  onResetModels?: () => void
  searchKeyword: string
  showModelFetcher?: boolean
}

/** Match SearchBar middle height (32px). */
const TOOLBAR_ACTION_ICON_SIZE = { blockSize: 32, border: 16 } as const

const styles = createStaticStyles(({ css }) => ({
  actions: css`
    @media (max-width: 768px) {
      width: 100%;

      > div:first-child {
        flex: 1;
        width: auto !important;
      }
    }
  `,
  header: css`
    @media (max-width: 768px) {
      flex-direction: column;
      align-items: flex-start;
    }
  `,
}))

const ModelTitle = memo<ModelTitleProps>(
  ({
    searchKeyword,
    onKeywordChange,
    loading,
    canClearRemoteModels = false,
    healthLoading = false,
    healthModelCount = 0,
    onAddCustomModel,
    onCancelHealthCheck,
    onClearRemoteModels,
    onHealthCheck,
    onFetch,
    showModelFetcher = true,
    onResetModels,
  }) => {
    const menuItems = useMemo<MenuProps['items']>(
      () => [
        ...(onResetModels
          ? [
              {
                icon: <RotateCcw size={16} />,
                key: 'reset-models',
                label: '重置所有修改',
                onClick: onResetModels,
              },
            ]
          : []),
        ...(onHealthCheck && healthModelCount > 0
          ? [
              ...(onResetModels ? [{ type: 'divider' as const }] : []),
              {
                icon: healthLoading ? <X size={16} /> : <Activity size={16} />,
                key: 'health-check',
                label: healthLoading ? '取消模型健康检查' : '模型健康检查',
                onClick: healthLoading ? onCancelHealthCheck : onHealthCheck,
              },
            ]
          : []),
        ...(showModelFetcher && onFetch
          ? [
              {
                disabled: loading,
                icon: <RefreshCcwDot size={16} />,
                key: 'fetch-models',
                label: loading ? '正在获取模型列表…' : '获取模型列表',
                onClick: onFetch,
              },
            ]
          : []),
      ],
      [
        healthLoading,
        healthModelCount,
        onCancelHealthCheck,
        onFetch,
        onHealthCheck,
        onResetModels,
        showModelFetcher,
        loading,
      ]
    )

    return (
      <Flex
        className='flex-col gap-3 py-2 w-full'
        style={{ background: cssVar.colorBgContainer, position: 'sticky', top: 0, zIndex: 15 }}
      >
        <Flex className={[styles.header, 'flex-between w-full']}>
          <Flex className='flex-row items-center gap-1'>
            <Text strong style={{ fontSize: 16 }}>
              模型列表
            </Text>
            {canClearRemoteModels && onClearRemoteModels ? (
              <ActionIcon icon={CircleX} size='small' title='清除获取的模型' onClick={onClearRemoteModels} />
            ) : null}
          </Flex>

          <Flex className={[styles.actions, 'flex-row items-center gap-1']}>
            <SearchBar
              className='h-8'
              placeholder='搜索模型'
              size='middle'
              style={{ width: 180 }}
              styles={{ input: { height: 32 } }}
              value={searchKeyword}
              onInputChange={onKeywordChange}
            />
            {onAddCustomModel ? (
              <ActionIcon
                variant='outlined'
                icon={<Plus size={16} />}
                size={TOOLBAR_ACTION_ICON_SIZE}
                title='添加自定义模型'
                onClick={onAddCustomModel}
              />
            ) : null}
            <DropdownMenu
              items={menuItems}
              nativeButton
              placement='bottomRight'
              triggerProps={{ className: 'size-8', title: '更多' }}
            >
              <ActionIcon variant='outlined' icon={<Ellipsis size={16} />} size={TOOLBAR_ACTION_ICON_SIZE} />
            </DropdownMenu>
          </Flex>
        </Flex>
      </Flex>
    )
  }
)

ModelTitle.displayName = 'ModelTitle'

export default ModelTitle
