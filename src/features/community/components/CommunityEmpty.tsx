'use client'

import { Center, Text } from '@pure/ui'
import { Empty } from '@lobehub/ui'
import { memo } from 'react'

export interface CommunityEmptyProps {
  description: string
  title: string
}

const CommunityEmpty = memo<CommunityEmptyProps>(({ description, title }) => {
  return (
    <Center height='100%' style={{ minHeight: '50vh' }} width='100%'>
      <Empty
        description={
          <>
            <Text strong>{title}</Text>
            <br />
            <Text className='text-[14px]' type='secondary'>
              {description}
            </Text>
          </>
        }
        style={{ maxWidth: 400 }}
      />
    </Center>
  )
})

CommunityEmpty.displayName = 'CommunityEmpty'

export default CommunityEmpty
