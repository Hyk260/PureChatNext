'use client'

import { Center, Text } from '@pure/ui'
import { Empty } from '@lobehub/ui'
import { memo } from 'react'

const ProviderEmpty = memo(() => {
  return (
    <Center height='100%' style={{ minHeight: '50vh' }} width='100%'>
      <Empty
        description={
          <>
            <Text strong>暂无模型服务商</Text>
            <br />
            <Text className='text-[14px]' type='secondary'>
              当前没有可展示的模型服务商
            </Text>
          </>
        }
        style={{ maxWidth: 400 }}
      />
    </Center>
  )
})

ProviderEmpty.displayName = 'ProviderEmpty'

export default ProviderEmpty
