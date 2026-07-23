'use client'

import { Button, Empty, Flex, Typography } from 'antd'
import { memo } from 'react'

interface EmptyModelsProps {
  loading?: boolean
  onFetch?: () => void
}

const EmptyModels = memo<EmptyModelsProps>(({ loading, onFetch }) => (
  <Flex vertical align='center' gap={12} style={{ paddingBlock: 32, width: '100%' }}>
    <Empty
      description={<Typography.Text type='secondary'>暂无模型</Typography.Text>}
      image={Empty.PRESENTED_IMAGE_SIMPLE}
    />
    {onFetch ? (
      <Button loading={loading} onClick={onFetch}>
        获取模型列表
      </Button>
    ) : null}
  </Flex>
))

EmptyModels.displayName = 'EmptyModels'

export default EmptyModels
