'use client'

import { Button, Empty, Flex, Text } from '@pure/ui'
import { memo } from 'react'

interface EmptyModelsProps {
  loading?: boolean
  onFetch?: () => void
}

const EmptyModels = memo<EmptyModelsProps>(({ loading, onFetch }) => (
  <Flex className='flex-col items-center gap-3 py-8 w-full'>
    <Empty description={<Text type='secondary'>暂无模型</Text>} />
    {onFetch ? (
      <Button loading={loading} onClick={onFetch}>
        获取模型列表
      </Button>
    ) : null}
  </Flex>
))

EmptyModels.displayName = 'EmptyModels'

export default EmptyModels
