'use client'

import { Button, Flex, Input, Typography } from 'antd'
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

const ModelTitle = memo<ModelTitleProps>(({ total, searchKeyword, onKeywordChange, loading, onFetch }) => (
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
        <Typography.Text strong style={{ fontSize: 16 }}>
          模型列表
        </Typography.Text>
        <Typography.Text type='secondary' style={{ fontSize: 12 }}>
          共 {total} 个模型可用
        </Typography.Text>
      </Flex>

      <Flex align='center' gap={8}>
        <Input.Search
          allowClear
          placeholder='搜索模型...'
          style={{ width: 180 }}
          value={searchKeyword}
          onChange={(event) => onKeywordChange(event.target.value)}
        />
        <Button icon={<LucideRefreshCcwDot size={16} />} loading={loading} onClick={onFetch}>
          获取模型列表
        </Button>
      </Flex>
    </Flex>
  </Flex>
))

ModelTitle.displayName = 'ModelTitle'

export default ModelTitle
