'use client'

import { Block, Icon, Text, Flex } from '@pure/ui'
import { createStaticStyles, cssVar, cx } from '@lobehub/ui'
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
  // 保留 createStaticStyles：依赖尚无对应 Tailwind 语义 token 的主题或运行时变量。
  card: css`
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
          <Text className='text-[20px]' strong>
            {platformMeta.name}
          </Text>
        </span>

        <Block className={cx(styles.card, 'p-4')}>
          <Flex className='items-center gap-4'>
            <PlatformAvatar platform={platform} size={48} />
            <Flex className='flex-col flex-1 gap-0.5'>
              <Text className='text-[15px]' strong>
                {platformMeta.name}
              </Text>
              <Text className='text-[13px]' type='secondary'>
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
