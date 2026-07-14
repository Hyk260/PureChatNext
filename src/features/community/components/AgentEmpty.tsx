'use client'

import { Center, Empty } from '@lobehub/ui'
import { Bot } from 'lucide-react'
import { memo } from 'react'

const AgentEmpty = memo(() => {
  return (
    <Center height='100%' style={{ minHeight: '50vh' }} width='100%'>
      <Empty
        description='试试调整分类或搜索关键词'
        icon={Bot}
        title='暂无匹配助理'
        type='page'
        descriptionProps={{
          fontSize: 14,
        }}
        style={{
          maxWidth: 400,
        }}
      />
    </Center>
  )
})

AgentEmpty.displayName = 'AgentEmpty'

export default AgentEmpty
