'use client'

import { Block, Icon, Text, Flex } from '@pure/ui'
import { createStaticStyles, cssVar, Divider } from '@lobehub/ui'
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
      <Text className='text-[15px]' strong>
        指令
      </Text>
      <Text className='text-[13px]' type='secondary'>
        {hint}
      </Text>

      <Block className={'overflow-hidden !p-0'} variant='outlined'>
        {MESSENGER_COMMANDS.map((item, index) => (
          <Fragment key={item.command}>
            {index > 0 && <Divider />}
            <Flex className='items-center gap-3 py-3.5 px-4'>
              <Flex className={[styles.icon, 'flex-center']}>
                <Icon icon={COMMAND_ICONS[item.icon]} size={18} />
              </Flex>
              <Text className='text-[14px]' code strong>
                {item.command}
              </Text>
              <Text className='flex-1 text-end text-[13px]' type='secondary'>
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
