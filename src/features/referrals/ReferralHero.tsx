import { Text, Flex } from '@pure/ui'

import logo from '@/assets/logos/purechat-mark.svg'

export function ReferralHero() {
  return (
    <Flex className='flex-center h-48 bg-linear-to-br from-indigo-400 via-blue-400 to-sky-400'>
      <Flex className='flex-col-center size-24 gap-1 rounded-3xl bg-white text-zinc-800 shadow-lg'>
        <img src={logo} alt='' className='size-12' />
        <Text as='span' fontSize={14} weight={600} color='inherit'>
          PureChat
        </Text>
      </Flex>
    </Flex>
  )
}
