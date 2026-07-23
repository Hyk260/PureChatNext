'use client'

import { Flex } from 'antd'
import MessengerPage from '@/features/settings/messenger/MessengerPage'
import { SettingHeader } from '@/features/settings/profile/components/SettingHeader'

export default function Page() {
  return (
    <Flex vertical gap={20} style={{ paddingBlock: '24px 64px', paddingInline: 24, width: '100%' }}>
      <SettingHeader title='聊天平台' />
      <MessengerPage />
    </Flex>
  )
}
