'use client'

import { Flex } from 'antd'
import { Text } from '@pure/ui'
import { memo } from 'react'

import { getMessengerPlatform, type MessengerPlatformId } from './const'
import { MessengerDetailShell, messengerDetailStyles } from './MessengerDetailShell'

interface MessengerComingSoonPageProps {
  platform: MessengerPlatformId
}

const MessengerComingSoonPage = memo<MessengerComingSoonPageProps>(({ platform }) => {
  const meta = getMessengerPlatform(platform)
  if (!meta) return null

  return (
    <MessengerDetailShell platform={meta.id} platformMeta={meta}>
      <Flex vertical gap={8}>
        <Text strong style={{ fontSize: 15 }}>
          连接 {meta.name}
        </Text>
        <div className={messengerDetailStyles.emptyRow}>即将推出，其它平台敬请期待。</div>
      </Flex>
    </MessengerDetailShell>
  )
})

MessengerComingSoonPage.displayName = 'MessengerComingSoonPage'

export default MessengerComingSoonPage
