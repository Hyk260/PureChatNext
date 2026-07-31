'use client'

import { Avatar } from 'antd'
import { Text, Flexbox } from '@pure/ui'
import { memo } from 'react'

import { useSession } from '@/libs/better-auth/client'

const ResourcesHeader = memo(() => {
  const { data: session } = useSession()

  return (
    <Flexbox horizontal align='center' justify='space-between' style={{ padding: 16, width: '100%' }}>
      <Text strong style={{ fontSize: 16 }}>
        资源
      </Text>
      <Avatar src={session?.user?.image ?? undefined} size={32} />
    </Flexbox>
  )
})

ResourcesHeader.displayName = 'ResourcesHeader'

export default ResourcesHeader
