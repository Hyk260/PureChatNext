'use client'

import { Flex, Typography } from 'antd'
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
        <Typography.Text strong style={{ fontSize: 15 }}>
          连接 {meta.name}
        </Typography.Text>
        <div className={messengerDetailStyles.emptyRow}>
          即将推出，其它平台敬请期待。
        </div>
      </Flex>
    </MessengerDetailShell>
  )
})

MessengerComingSoonPage.displayName = 'MessengerComingSoonPage'

export default MessengerComingSoonPage
