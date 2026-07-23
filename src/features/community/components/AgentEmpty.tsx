'use client'

import { Center } from '@pure/ui'
import { Empty, Typography } from 'antd'
import { memo } from 'react'

const AgentEmpty = memo(() => {
  return (
    <Center height='100%' style={{ minHeight: '50vh' }} width='100%'>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <>
            <Typography.Text strong>暂无匹配助理</Typography.Text>
            <br />
            <Typography.Text type='secondary' style={{ fontSize: 14 }}>
              试试调整分类或搜索关键词
            </Typography.Text>
          </>
        }
        style={{ maxWidth: 400 }}
      />
    </Center>
  )
})

AgentEmpty.displayName = 'AgentEmpty'

export default AgentEmpty
