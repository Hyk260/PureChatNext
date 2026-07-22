'use client'

import { Block, Flexbox, Icon, Text } from '@lobehub/ui'
import { Divider } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import {
  BotIcon,
  CircleStopIcon,
  HelpCircleIcon,
  MegaphoneIcon,
  SquarePlusIcon,
  type LucideIcon,
} from 'lucide-react'
import { Fragment, memo } from 'react'

import { WECHAT_COMMANDS, type MessengerCommandItem } from './const'

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
    <Flexbox gap={8} width="100%">
      <Text strong style={{ fontSize: 15 }}>
        指令
      </Text>
      <Text style={{ fontSize: 13 }} type="secondary">
        在与机器人的私信中发送以下指令。
      </Text>

      <Block className={styles.list} variant="outlined">
        {WECHAT_COMMANDS.map((item, index) => (
          <Fragment key={item.command}>
            {index > 0 && <Divider style={{ margin: 0 }} />}
            <Flexbox align="center" gap={12} horizontal paddingBlock={14} paddingInline={16}>
              <Flexbox align="center" className={styles.icon} horizontal justify="center">
                <Icon icon={COMMAND_ICONS[item.icon]} size={18} />
              </Flexbox>
              <Text code fontSize={14} strong>
                {item.command}
              </Text>
              <Text
                style={{ flex: 1, fontSize: 13, textAlign: 'end' }}
                type="secondary"
              >
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
