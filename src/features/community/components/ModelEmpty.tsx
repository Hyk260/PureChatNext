'use client'

import { Center } from '@pure/ui'
import { Empty, Typography } from 'antd'
import { memo } from 'react'

const ModelEmpty = memo(() => {
  return (
    <Center height='100%' style={{ minHeight: '50vh' }} width='100%'>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <>
            <Typography.Text strong>暂无模型</Typography.Text>
            <br />
            <Typography.Text type='secondary' style={{ fontSize: 14 }}>
              模型列表即将上线，敬请期待
            </Typography.Text>
          </>
        }
        style={{ maxWidth: 400 }}
      />
    </Center>
  )
})

ModelEmpty.displayName = 'ModelEmpty'

export default ModelEmpty
