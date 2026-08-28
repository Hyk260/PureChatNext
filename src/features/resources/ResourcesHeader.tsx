'use client'

import { Avatar } from 'antd'
import { Text, Flex } from '@pure/ui'
import { memo } from 'react'

import { useSession } from '@/libs/better-auth/client'

const ResourcesHeader = memo(() => {
  const { data: session } = useSession()

  return (
    <Flex className='flex-between p-4 w-full'>
      <Text strong style={{ fontSize: 16 }}>
        资源
      </Text>
      <Avatar src={session?.user?.image ?? undefined} size={32} />
    </Flex>
  )
})

ResourcesHeader.displayName = 'ResourcesHeader'

export default ResourcesHeader
