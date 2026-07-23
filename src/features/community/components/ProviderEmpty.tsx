'use client'

import { Center } from '@pure/ui'
import { Empty, Typography } from 'antd'
import { memo } from 'react'

const ProviderEmpty = memo(() => {
  return (
    <Center height='100%' style={{ minHeight: '50vh' }} width='100%'>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <>
            <Typography.Text strong>暂无模型服务商</Typography.Text>
            <br />
            <Typography.Text type='secondary' style={{ fontSize: 14 }}>
              当前没有可展示的模型服务商
            </Typography.Text>
          </>
        }
        style={{ maxWidth: 400 }}
      />
    </Center>
  )
})

ProviderEmpty.displayName = 'ProviderEmpty'

export default ProviderEmpty
