'use client'

import { Center, Empty } from '@lobehub/ui'
import { Brain } from 'lucide-react'
import { memo } from 'react'

const ModelEmpty = memo(() => {
  return (
    <Center height='100%' style={{ minHeight: '50vh' }} width='100%'>
      <Empty
        description='模型列表即将上线，敬请期待'
        icon={Brain}
        title='暂无模型'
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

ModelEmpty.displayName = 'ModelEmpty'

export default ModelEmpty
