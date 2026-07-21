'use client'

import { Button, Empty, Flexbox, Text } from '@lobehub/ui'
import { memo } from 'react'

interface EmptyModelsProps {
  loading?: boolean
  onFetch?: () => void
}

const EmptyModels = memo<EmptyModelsProps>(({ loading, onFetch }) => (
  <Flexbox align='center' gap={12} paddingBlock={32} width='100%'>
    <Empty description={<Text type='secondary'>暂无模型</Text>} />
    {onFetch ? (
      <Button loading={loading} onClick={onFetch}>
        获取模型列表
      </Button>
    ) : null}
  </Flexbox>
))

EmptyModels.displayName = 'EmptyModels'

export default EmptyModels
