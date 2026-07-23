'use client'

import { Flex, Typography } from 'antd'
import { Block, Icon } from '@pure/ui'
import { useApp } from '@/components/AntdStaticMethods'
import { createStaticStyles, cssVar } from 'antd-style'
import { ChevronRightIcon } from 'lucide-react'
import { memo, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'

import {
  MESSENGER_PLATFORMS,
  MESSENGER_SUBTITLE,
  getMessengerPlatform,
  type MessengerPlatformId,
} from './const'
import MessengerComingSoonPage from './MessengerComingSoonPage'
import MessengerQQPage from './MessengerQQPage'
import MessengerWeChatPage from './MessengerWeChatPage'
import { PlatformAvatar } from './PlatformAvatar'

const styles = createStaticStyles(({ css }) => ({
  card: css`
    cursor: pointer;

    padding: 16px;
    border: 1px solid ${cssVar.colorBorder};
    border-radius: ${cssVar.borderRadius};

    transition: border-color 0.2s ease;

    &:hover {
      border-color: ${cssVar.colorPrimaryBorderHover};
    }
  `,
  grid: css`
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;

    @media (width <= 720px) {
      grid-template-columns: 1fr;
    }
  `,
}))

const COMING_SOON_IDS = new Set<MessengerPlatformId>(['slack', 'telegram', 'discord'])

const isMessengerPlatform = (value: string | undefined): value is MessengerPlatformId => {
  return Boolean(value && getMessengerPlatform(value))
}

const MessengerPage = memo(() => {
  const navigate = useNavigate()
  const { message } = useApp()
  const { platform } = useParams<{ platform?: string }>()

  // TODO: 第一期所有渠道暂未开放，点击仅提示「敬请期待」。
  // 后续逐个接入时，把 handleSelectPlatform 内对应分支改回 navigate 跳转即可。
  const handleSelectPlatform = (item: { id: MessengerPlatformId }) => {
    // TODO(messenger): 接入该平台详情页后启用跳转
    // navigate(`/settings/messenger/${item.id}`)
    message.info('敬请期待')
  }

  useEffect(() => {
    if (platform && !isMessengerPlatform(platform)) {
      navigate('/settings/messenger', { replace: true })
    }
  }, [navigate, platform])

  if (platform === 'wechat') {
    return <MessengerWeChatPage />
  }

  if (platform === 'qq') {
    return <MessengerQQPage />
  }

  if (platform && COMING_SOON_IDS.has(platform as MessengerPlatformId)) {
    return <MessengerComingSoonPage platform={platform as MessengerPlatformId} />
  }

  return (
    <Flex vertical gap={20} style={{ width: "100%" }}>
      <Typography.Text type="secondary">{MESSENGER_SUBTITLE}</Typography.Text>
      <div className={styles.grid}>
        {MESSENGER_PLATFORMS.map((item) => (
          <Block
            className={styles.card}
            key={item.id}
            onClick={() => handleSelectPlatform(item)}
          >
            <Flex align="center" gap={16}>
              <PlatformAvatar platform={item.id} size={48} />
              <Flex vertical flex={1} gap={2}>
                <Typography.Text strong style={{ fontSize: 15 }}>
                  {item.name}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {item.description}
                </Typography.Text>
              </Flex>
              <Icon icon={ChevronRightIcon} />
            </Flex>
          </Block>
        ))}
      </div>
    </Flex>
  )
})

MessengerPage.displayName = 'MessengerPage'

export default MessengerPage
