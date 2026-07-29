'use client'

import { Center, Text } from '@pure/ui'
import { Empty } from 'antd'
import { memo } from 'react'

const ModelEmpty = memo(() => {
  return (
    <Center height='100%' style={{ minHeight: '50vh' }} width='100%'>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <>
            <Text strong>暂无模型</Text>
            <br />
            <Text type='secondary' style={{ fontSize: 14 }}>
              模型列表即将上线，敬请期待
            </Text>
          </>
        }
        style={{ maxWidth: 400 }}
      />
    </Center>
  )
})

ModelEmpty.displayName = 'ModelEmpty'

export default ModelEmpty
