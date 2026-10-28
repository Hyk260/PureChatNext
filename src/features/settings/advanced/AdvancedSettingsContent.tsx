'use client'

import { Switch } from '@lobehub/ui'
import { Block, Flex, Text } from '@pure/ui'

import { useChatUiStore } from '@/features/chat/store/useChatUiStore'

export default function AdvancedSettingsContent() {
  const showMessageUsage = useChatUiStore((state) => state.showMessageUsage)
  const setShowMessageUsage = useChatUiStore((state) => state.setShowMessageUsage)

  return (
    <Flex className='w-full flex-col gap-5 px-4 py-6 sm:px-8'>
      <Block className='rounded-2xl p-5 sm:p-6' variant='outlined'>
        <Flex className='flex-between gap-6'>
          <Flex className='min-w-0 flex-col gap-1'>
            <Text className='text-base font-semibold'>高级工具</Text>
            <Text className='text-[13px]' type='secondary'>
              显示消息中的模型、TPS 与 Token 用量等技术细节。不会改变模型回复方式。
            </Text>
          </Flex>
          <Switch
            aria-label='显示消息用量信息'
            checked={showMessageUsage}
            onChange={setShowMessageUsage}
          />
        </Flex>
      </Block>
    </Flex>
  )
}
