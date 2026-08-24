'use client'

import { ActionIcon, DropdownMenu, Flexbox, SearchBar, Text } from '@pure/ui'
import type { MenuProps } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { Activity, MoreVertical, Plus, RefreshCcwDot, RotateCcw, X } from 'lucide-react'
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
        {
          disabled: !onResetModels,
          icon: <RotateCcw size={16} />,
          key: 'reset-models',
          label: '重置所有修改',
          onClick: onResetModels,
        },
        ...(onHealthCheck && healthModelCount > 0
          ? [
              { type: 'divider' as const },
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
      <Flexbox
        gap={12}
        style={{
          background: cssVar.colorBgContainer,
          paddingBlock: 8,
          position: 'sticky',
          top: 0,
          width: '100%',
          zIndex: 15,
        }}
      >
        <Flexbox horizontal align='center' className={styles.header} justify='space-between' width='100%'>
          <Flexbox horizontal align='center' gap={4}>
            <Text strong style={{ fontSize: 16 }}>
              模型列表
            </Text>
            {canClearRemoteModels && onClearRemoteModels ? (
              <ActionIcon icon={X} size='small' title='清除获取的模型' onClick={onClearRemoteModels} />
            ) : null}
          </Flexbox>

          <Flexbox horizontal align='center' className={styles.actions} gap={4}>
            <SearchBar
              className='h-8'
              placeholder='搜索模型...'
              size='middle'
              style={{ width: 180 }}
              styles={{ input: { height: 32 } }}
              value={searchKeyword}
              onInputChange={onKeywordChange}
            />
            {onAddCustomModel ? (
              <ActionIcon icon={Plus} size='small' title='添加自定义模型' onClick={onAddCustomModel} />
            ) : null}
            <DropdownMenu
              items={menuItems}
              nativeButton
              placement='bottomRight'
              triggerProps={{ className: 'size-8', title: '更多' }}
            >
              <ActionIcon icon={MoreVertical} size='small' />
            </DropdownMenu>
          </Flexbox>
        </Flexbox>
      </Flexbox>
    )
  }
)

ModelTitle.displayName = 'ModelTitle'

export default ModelTitle
