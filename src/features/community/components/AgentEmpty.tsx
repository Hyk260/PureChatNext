'use client'

import { Center, Empty } from '@lobehub/ui'
import { Bot } from 'lucide-react'
import { memo } from 'react'

const AgentEmpty = memo(() => {
  return (
    <Center height='100%' style={{ minHeight: '50vh' }} width='100%'>
      <Empty
        description='助理列表即将上线，敬请期待'
        icon={Bot}
        title='暂无助理'
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
