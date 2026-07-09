'use client'

import { Center, Empty } from '@lobehub/ui'
import { Cloud } from 'lucide-react'
import { memo } from 'react'

const ProviderEmpty = memo(() => {
  return (
    <Center height='100%' style={{ minHeight: '50vh' }} width='100%'>
      <Empty
        description='当前没有可展示的模型服务商'
        icon={Cloud}
        title='暂无模型服务商'
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

ProviderEmpty.displayName = 'ProviderEmpty'

export default ProviderEmpty
