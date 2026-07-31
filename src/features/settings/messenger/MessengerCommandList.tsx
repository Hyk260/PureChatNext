'use client'

import { Block, Icon, Text, Flexbox } from '@pure/ui'
import { Divider } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { BotIcon, CircleStopIcon, HelpCircleIcon, MegaphoneIcon, SquarePlusIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Fragment, memo } from 'react'

import { WECHAT_COMMANDS } from './const'
import type { MessengerCommandItem } from './const'

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

const MessengerCommandList = memo(() => {
  return (
    <Flexbox gap={8} style={{ width: '100%' }}>
      <Text strong style={{ fontSize: 15 }}>
        指令
      </Text>
      <Text type='secondary' style={{ fontSize: 13 }}>
        在与机器人的私信中发送以下指令。
      </Text>

      <Block className={styles.list} variant='outlined'>
        {WECHAT_COMMANDS.map((item, index) => (
          <Fragment key={item.command}>
            {index > 0 && <Divider style={{ margin: 0 }} />}
            <Flexbox horizontal align='center' gap={12} style={{ paddingBlock: 14, paddingInline: 16 }}>
              <Flexbox horizontal align='center' className={styles.icon} justify='center'>
                <Icon icon={COMMAND_ICONS[item.icon]} size={18} />
              </Flexbox>
              <Text code strong style={{ fontSize: 14 }}>
                {item.command}
              </Text>
              <Text type='secondary' style={{ flex: 1, fontSize: 13, textAlign: 'end' }}>
                {item.description}
              </Text>
            </Flexbox>
          </Fragment>
        ))}
      </Block>
    </Flexbox>
  )
})

MessengerCommandList.displayName = 'MessengerCommandList'

export default MessengerCommandList
