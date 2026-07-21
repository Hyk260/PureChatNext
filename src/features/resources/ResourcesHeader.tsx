'use client'

import { Flexbox, Text , Avatar } from '@lobehub/ui'
import { memo } from 'react'

import { useSession } from '@/libs/better-auth/client'

const ResourcesHeader = memo(() => {
  const { data: session } = useSession()

  return (
    <Flexbox align='center' horizontal justify='space-between' padding={16} width='100%'>
      <Text fontSize={16} strong>
        资源
      </Text>
      <Avatar avatar={session?.user?.image ?? undefined} size={32} />
    </Flexbox>
  )
})

ResourcesHeader.displayName = 'ResourcesHeader'

export default ResourcesHeader
