'use client'

import { Button, Flexbox, SearchBar, Text } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { Activity, LucideRefreshCcwDot, X } from 'lucide-react'
import { memo } from 'react'

interface ModelTitleProps {
  loading: boolean
  healthLoading?: boolean
  healthModelCount?: number
  onCancelHealthCheck?: () => void
  onHealthCheck?: () => void
  onFetch?: () => void
  onKeywordChange: (keyword: string) => void
  searchKeyword: string
  showModelFetcher?: boolean
  total: number
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
    total,
    searchKeyword,
    onKeywordChange,
    loading,
    healthLoading = false,
    healthModelCount = 0,
    onCancelHealthCheck,
    onHealthCheck,
    onFetch,
    showModelFetcher = true,
  }) => (
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
        <Flexbox horizontal align='center' gap={8}>
          <Text strong style={{ fontSize: 16 }}>
            模型列表
          </Text>
          <Text type='secondary' style={{ fontSize: 12 }}>
            共 {total} 个模型可用
          </Text>
        </Flexbox>

        <Flexbox horizontal align='center' className={styles.actions} gap={8}>
          <SearchBar
            className='h-8'
            placeholder='搜索模型...'
            size='middle'
            style={{ width: 180 }}
            styles={{ input: { height: 32 } }}
            value={searchKeyword}
            onInputChange={onKeywordChange}
          />
          {onHealthCheck && healthModelCount > 0 ? (
            <Button
              className='h-8'
              icon={healthLoading ? <X size={16} /> : <Activity size={16} />}
              onClick={healthLoading ? onCancelHealthCheck : onHealthCheck}
            >
              {healthLoading ? '取消检查' : '模型健康检查'}
            </Button>
          ) : null}
          {showModelFetcher && onFetch ? (
            <Button className='h-8' icon={<LucideRefreshCcwDot size={16} />} loading={loading} onClick={onFetch}>
              获取模型列表
            </Button>
          ) : null}
        </Flexbox>
      </Flexbox>
    </Flexbox>
  )
)

ModelTitle.displayName = 'ModelTitle'

export default ModelTitle
