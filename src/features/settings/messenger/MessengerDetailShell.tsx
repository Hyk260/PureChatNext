'use client'

import { Block, Icon, Text, Flex } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { ArrowLeftIcon } from 'lucide-react'
import { memo } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'

import type { MessengerPlatformId, MessengerPlatformMeta } from './const'
import { PlatformAvatar } from './PlatformAvatar'

const styles = createStaticStyles(({ css }) => ({
  backButton: css`
    cursor: pointer;

    display: inline-flex;
    gap: 6px;
    align-items: center;

    color: ${cssVar.colorTextSecondary};

    &:hover {
      color: ${cssVar.colorText};
    }
  `,
  card: css`
    padding: 16px;
    border: 1px solid ${cssVar.colorBorder};
    border-radius: ${cssVar.borderRadius};
  `,
  emptyRow: css`
    padding-block: 32px;
    padding-inline: 16px;
    border: 1px dashed ${cssVar.colorBorder};
    border-radius: ${cssVar.borderRadius};

    color: ${cssVar.colorTextSecondary};
    text-align: center;
  `,
}))

interface MessengerDetailShellProps {
  children?: ReactNode
  headerAction?: ReactNode
  platform: MessengerPlatformId
  platformMeta: MessengerPlatformMeta
}

/** 详情页共用壳：返回行 + 品牌卡（页面标题由 SettingsHeader 渲染） */
export const MessengerDetailShell = memo<MessengerDetailShellProps>(
  ({ children, headerAction, platform, platformMeta }) => {
    const navigate = useNavigate()

    return (
      <Flex className='flex-col gap-5 w-full'>
        <span
          className={styles.backButton}
          role='button'
          tabIndex={0}
          onClick={() => navigate('/settings/messenger')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') navigate('/settings/messenger')
          }}
        >
          <Icon icon={ArrowLeftIcon} size='small' />
          <Text strong style={{ fontSize: 20 }}>
            {platformMeta.name}
          </Text>
        </span>

        <Block className={styles.card}>
          <Flex className='flex-row items-center gap-4'>
            <PlatformAvatar platform={platform} size={48} />
            <Flex className='flex-col flex-1 gap-0.5'>
              <Text strong style={{ fontSize: 15 }}>
                {platformMeta.name}
              </Text>
              <Text type='secondary' style={{ fontSize: 13 }}>
                {platformMeta.description}
              </Text>
            </Flex>
            {headerAction}
          </Flex>
        </Block>

        {children}
      </Flex>
    )
  }
)

MessengerDetailShell.displayName = 'MessengerDetailShell'

export { styles as messengerDetailStyles }
