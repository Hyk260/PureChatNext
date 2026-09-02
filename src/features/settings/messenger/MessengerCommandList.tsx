'use client'

import { Block, Icon, Text, Flex } from '@pure/ui'
import { Divider } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { BotIcon, CircleStopIcon, HelpCircleIcon, MegaphoneIcon, SquarePlusIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Fragment, memo } from 'react'

import { MESSENGER_COMMANDS } from './const'
import type { MessengerCommandItem, MessengerPlatformId } from './const'

const styles = createStaticStyles(({ css }) => ({
  icon: css`
    flex: none;

    width: 36px;
    height: 36px;
    border-radius: 8px;

    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorFillTertiary};
  `,
  list: css`
    overflow: hidden;
    padding: 0 !important;
  `,
}))

const COMMAND_ICONS: Record<MessengerCommandItem['icon'], LucideIcon> = {
  agents: BotIcon,
  feedback: MegaphoneIcon,
  help: HelpCircleIcon,
  new: SquarePlusIcon,
  stop: CircleStopIcon,
}

const PLATFORM_HINT: Partial<Record<MessengerPlatformId, string>> = {
  qq: '在与机器人的私信或群 @ 中发送以下指令。',
  wechat: '在与机器人的私信中发送以下指令。',
}

type MessengerCommandListProps = {
  platform?: MessengerPlatformId
}

const MessengerCommandList = memo(({ platform }: MessengerCommandListProps) => {
  const hint = (platform && PLATFORM_HINT[platform]) || '在与机器人的私信中发送以下指令。'

  return (
    <Flex className='flex-col gap-2 w-full'>
      <Text strong style={{ fontSize: 15 }}>
        指令
      </Text>
      <Text type='secondary' style={{ fontSize: 13 }}>
        {hint}
      </Text>

      <Block className={styles.list} variant='outlined'>
        {MESSENGER_COMMANDS.map((item, index) => (
          <Fragment key={item.command}>
            {index > 0 && <Divider style={{ margin: 0 }} />}
            <Flex className='flex-row items-center gap-3 py-3.5 px-4'>
              <Flex className={[styles.icon, 'flex-center']}>
                <Icon icon={COMMAND_ICONS[item.icon]} size={18} />
              </Flex>
              <Text code strong style={{ fontSize: 14 }}>
                {item.command}
              </Text>
              <Text type='secondary' style={{ flex: 1, fontSize: 13, textAlign: 'end' }}>
                {item.description}
              </Text>
            </Flex>
          </Fragment>
        ))}
      </Block>
    </Flex>
  )
})

MessengerCommandList.displayName = 'MessengerCommandList'

export default MessengerCommandList
