'use client'

import { Flex, Tooltip } from 'antd'
import { Icon, Popover } from '@pure/ui'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import {
  ChevronDownIcon,
  InfinityIcon,
  MessageCircleIcon,
} from 'lucide-react'
import { memo, useCallback, useState } from 'react'

import { type HomeAgentMode, useHomeStore } from '@/features/home/store/useHomeStore'

const styles = createStaticStyles(({ css }) => ({
  activeOption: css`
    background: ${cssVar.colorFillSecondary};
  `,
  button: css`
    cursor: pointer;
    display: flex;
    gap: 6px;
    align-items: center;
    height: 28px;
    padding-inline: 8px;
    border-radius: 999px;
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
    background: ${cssVar.colorFillTertiary};
    transition: all 0.2s;

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
    }
  `,
  option: css`
    cursor: pointer;
    width: 100%;
    padding-block: 10px;
    padding-inline: 8px;
    border-radius: ${cssVar.borderRadius};
    transition: background-color 0.2s;

    &:hover {
      background: ${cssVar.colorFillSecondary};
    }
  `,
  optionDesc: css`
    font-size: 12px;
    line-height: 1.4;
    color: ${cssVar.colorTextDescription};
  `,
  optionIcon: css`
    flex-shrink: 0;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadius};
    background: ${cssVar.colorBgElevated};
  `,
  optionTitle: css`
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
    color: ${cssVar.colorText};
  `,
}))

const AgentModeButton = memo(() => {
  const [open, setOpen] = useState(false)
  const agentMode = useHomeStore((s) => s.agentMode)
  const setAgentMode = useHomeStore((s) => s.setAgentMode)

  const currentMode = agentMode
  const CurrentIcon = currentMode === 'agent' ? InfinityIcon : MessageCircleIcon

  const handleSelect = useCallback(
    (mode: HomeAgentMode) => {
      setAgentMode(mode)
      setOpen(false)
    },
    [setAgentMode],
  )

  const popoverContent = (
    <Flex vertical gap={4} style={{ maxWidth: 320, minWidth: 280 }}>
      <Flex align='center' className={cx(styles.option, currentMode === 'agent' && styles.activeOption)} gap={12} onClick={() => handleSelect('agent')}>
        <Flex vertical align='center' className={styles.optionIcon} justify='center' style={{ height: 32, width: 32 }}>
          <Icon icon={InfinityIcon} size={16} />
        </Flex>
        <Flex vertical flex={1}>
          <div className={styles.optionTitle}>智能</div>
          <div className={styles.optionDesc}>工具、联网、文件与环境</div>
        </Flex>
      </Flex>

      <Flex align='center' className={cx(styles.option, currentMode === 'chat' && styles.activeOption)} gap={12} onClick={() => handleSelect('chat')}>
        <Flex vertical align='center' className={styles.optionIcon} justify='center' style={{ height: 32, width: 32 }}>
          <Icon icon={MessageCircleIcon} size={16} />
        </Flex>
        <Flex vertical flex={1}>
          <div className={styles.optionTitle}>对话</div>
          <div className={styles.optionDesc}>快速问答与日常聊天</div>
        </Flex>
      </Flex>
    </Flex>
  )

  const button = (
    <div className={styles.button}>
      <Icon icon={CurrentIcon} size={14} />
      <span>{currentMode === 'agent' ? '智能' : '对话'}</span>
      <Icon icon={ChevronDownIcon} size={12} />
    </div>
  )

  return (
    <Popover
      content={popoverContent}
      open={open}
      placement='bottomLeft'
      styles={{ content: { border: `1px solid ${cssVar.colorBorderSecondary}`, padding: 4 } }}
      trigger='click'
      onOpenChange={setOpen}
    >
      <div>{open ? button : <Tooltip title='切换智能/对话模式'>{button}</Tooltip>}</div>
    </Popover>
  )
})

AgentModeButton.displayName = 'AgentModeButton'

export default AgentModeButton
