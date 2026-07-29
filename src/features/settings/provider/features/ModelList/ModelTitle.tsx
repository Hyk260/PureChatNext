'use client'

import { Button, Flex } from 'antd'
import { SearchBar, Text } from '@pure/ui'
import { cssVar } from 'antd-style'
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

const ModelTitle = memo<ModelTitleProps>(
  ({ total, searchKeyword, onKeywordChange, loading, onFetch, showModelFetcher = true }) => (
    <Flex
      vertical
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
      <Flex align='center' justify='space-between' style={{ width: '100%' }}>
        <Flex align='center' gap={8}>
          <Text strong style={{ fontSize: 16 }}>
            模型列表
          </Text>
          <Text type='secondary' style={{ fontSize: 12 }}>
            共 {total} 个模型可用
          </Text>
        </Flex>

        <Flex align='center' gap={8}>
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
        </Flex>
      </Flex>
    </Flex>
  )
)

ModelTitle.displayName = 'ModelTitle'

export default ModelTitle
