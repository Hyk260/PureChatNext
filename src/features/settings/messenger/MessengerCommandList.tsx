'use client'

import { Block } from '@pure/ui'
import { Icon } from '@pure/ui'
import { Flex, Typography, Divider } from 'antd'
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
    <Flex vertical gap={8} style={{ width: "100%" }}>
      <Typography.Text strong style={{ fontSize: 15 }}>
        指令
      </Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        在与机器人的私信中发送以下指令。
      </Typography.Text>

      <Block className={styles.list} variant="outlined">
        {WECHAT_COMMANDS.map((item, index) => (
          <Fragment key={item.command}>
            {index > 0 && <Divider style={{ margin: 0 }} />}
            <Flex align="center" gap={12} style={{ paddingBlock: 14, paddingInline: 16 }}>
              <Flex align="center" className={styles.icon} justify="center">
                <Icon icon={COMMAND_ICONS[item.icon]} size={18} />
              </Flex>
              <Typography.Text code strong style={{ fontSize: 14 }}>
                {item.command}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ flex: 1, fontSize: 13, textAlign: 'end' }}>
                {item.description}
              </Typography.Text>
            </Flex>
          </Fragment>
        ))}
      </Block>
    </Flex>
  )
})

MessengerCommandList.displayName = 'MessengerCommandList'

export default MessengerCommandList
