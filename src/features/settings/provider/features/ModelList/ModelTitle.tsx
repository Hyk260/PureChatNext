'use client'

import { Button, Flexbox, SearchBar, Text } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { LucideRefreshCcwDot } from 'lucide-react'
import { memo } from 'react'

interface ModelTitleProps {
  loading: boolean
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
  ({ total, searchKeyword, onKeywordChange, loading, onFetch, showModelFetcher = true }) => (
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
            placeholder='搜索模型...'
            style={{ width: 180 }}
            value={searchKeyword}
            onInputChange={onKeywordChange}
          />
          {showModelFetcher && onFetch ? (
            <Button icon={<LucideRefreshCcwDot size={16} />} loading={loading} onClick={onFetch}>
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
