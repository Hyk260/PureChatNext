'use client'

import { Button, Flexbox, SearchBar, Text } from '@lobehub/ui'
import { cssVar } from 'antd-style'
import { LucideRefreshCcwDot } from 'lucide-react'
import { memo } from 'react'

interface ModelTitleProps {
  loading: boolean
  onFetch: () => void
  onKeywordChange: (keyword: string) => void
  searchKeyword: string
  total: number
}

const ModelTitle = memo<ModelTitleProps>(
  ({ total, searchKeyword, onKeywordChange, loading, onFetch }) => (
    <Flexbox
      gap={12}
      paddingBlock={8}
      style={{
        background: cssVar.colorBgContainer,
        position: 'sticky',
        top: 0,
        zIndex: 15,
      }}
      width='100%'
    >
      <Flexbox horizontal align='center' justify='space-between' width='100%'>
        <Flexbox horizontal align='center' gap={8}>
          <Text strong style={{ fontSize: 16 }}>
            模型列表
          </Text>
          <Text fontSize={12} type='secondary'>
            共 {total} 个模型可用
          </Text>
        </Flexbox>

        <Flexbox horizontal align='center' gap={8}>
          <SearchBar
            allowClear
            placeholder='搜索模型...'
            size='small'
            style={{ width: 180 }}
            value={searchKeyword}
            onChange={(event) => onKeywordChange(event.target.value)}
          />
          <Button icon={LucideRefreshCcwDot} loading={loading} onClick={onFetch}>
            获取模型列表
          </Button>
        </Flexbox>
      </Flexbox>
    </Flexbox>
  ),
)

ModelTitle.displayName = 'ModelTitle'

export default ModelTitle
