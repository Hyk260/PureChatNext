'use client'

import { Block, Flexbox, Icon, Text } from '@lobehub/ui'
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
  const { platform } = useParams<{ platform?: string }>()

  useEffect(() => {
    if (platform && !isMessengerPlatform(platform)) {
      navigate('/settings/messenger', { replace: true })
    }
  }, [navigate, platform])

  if (platform === 'wechat') {
    return <MessengerWeChatPage />
  }

  if (platform && COMING_SOON_IDS.has(platform as MessengerPlatformId)) {
    return <MessengerComingSoonPage platform={platform as MessengerPlatformId} />
  }

  return (
    <Flexbox gap={20} width="100%">
      <Text type="secondary">{MESSENGER_SUBTITLE}</Text>
      <div className={styles.grid}>
        {MESSENGER_PLATFORMS.map((item) => (
          <Block
            className={styles.card}
            key={item.id}
            onClick={() => navigate(`/settings/messenger/${item.id}`)}
          >
            <Flexbox horizontal align="center" gap={16}>
              <PlatformAvatar platform={item.id} size={48} />
              <Flexbox flex={1} gap={2}>
                <Text strong style={{ fontSize: 15 }}>
                  {item.name}
                </Text>
                <Text style={{ fontSize: 13 }} type="secondary">
                  {item.description}
                </Text>
              </Flexbox>
              <Icon icon={ChevronRightIcon} />
            </Flexbox>
          </Block>
        ))}
      </div>
    </Flexbox>
  )
})

MessengerPage.displayName = 'MessengerPage'

export default MessengerPage
