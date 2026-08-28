'use client'

import MessengerPage from '@/features/settings/messenger/MessengerPage'
import { Flex } from '@pure/ui'

export default function Page() {
  return (
    <Flex className='flex-col gap-5 py-[24px_64px] px-6 w-full'>
      <MessengerPage />
    </Flex>
  )
}
