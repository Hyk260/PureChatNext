'use client'

import { Avatar, Flex } from 'antd'
import { Text } from '@pure/ui'
import { memo } from 'react'

import { useSession } from '@/libs/better-auth/client'

const ResourcesHeader = memo(() => {
  const { data: session } = useSession()

  return (
    <Flex align='center' justify='space-between' style={{ padding: 16, width: '100%' }}>
      <Text strong style={{ fontSize: 16 }}>
        资源
      </Text>
      <Avatar src={session?.user?.image ?? undefined} size={32} />
    </Flex>
  )
})

ResourcesHeader.displayName = 'ResourcesHeader'

export default ResourcesHeader
