'use client'

import { Flex } from 'antd'
import { type MenuProps, DropdownMenuPopup, DropdownMenuPortal, DropdownMenuPositioner, DropdownMenuRoot, DropdownMenuTrigger, renderDropdownMenuItems } from '@pure/ui'
import { Block, Icon } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import {
  Check,
  ChevronRight,
  GlobeOff,
  LibraryBig,
  Plus,
  Settings2,
} from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'

import ModelSelector from '@/features/chat/ModelSelector'
import { SendButton } from '@/features/chat/SendArea'

const styles = createStaticStyles(({ css }) => ({
  input: css`
    width: 100%;
    min-height: 44px;
    max-height: 200px;
    padding: 0;
    border: none;
    outline: none;
    resize: none;
    background: transparent;
    color: ${cssVar.colorText};
    font-size: 15px;
    line-height: 1.6;

    &::placeholder {
      color: ${cssVar.colorTextQuaternary};
    }
  `,
  menuLabel: css`
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    width: 100%;

    span {
      overflow: hidden;
      min-width: 0;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  menuPopup: css`
    min-width: 220px;
  `,
  plusTrigger: css`
    cursor: pointer;

    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;

    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 16px;

    color: ${cssVar.colorTextSecondary};
    background: transparent;

    &:hover {
      background: ${cssVar.colorFillSecondary};
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
  `,
  shell: css`
    border-radius: 16px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
  `,
  srOnly: css`
    position: absolute;

    overflow: hidden;

    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    border: 0;

    white-space: nowrap;

    clip: rect(0, 0, 0, 0);
  `,
  submenuChevron: css`
    flex: none;
    color: ${cssVar.colorTextQuaternary};
  `,
}))

interface ChatInputProps {
  isBusy?: boolean
  onSend: (text: string) => void | Promise<void>
  onStop?: () => void
}

const MenuLabel = memo<{
  active?: boolean
  chevron?: boolean
  label: string
}>(({ label, chevron, active }) => (
  <div className={styles.menuLabel}>
    <span>{label}</span>
    {chevron ? (
      <Icon className={styles.submenuChevron} icon={ChevronRight} size={16} />
    ) : active ? (
      <Icon icon={Check} size={16} />
    ) : null}
  </div>
))

MenuLabel.displayName = 'MenuLabel'

const ChatInput = memo<ChatInputProps>(({ isBusy, onSend, onStop }) => {
  const [input, setInput] = useState('')
  const [plusOpen, setPlusOpen] = useState(false)

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || isBusy) return

    // Clear immediately so the input is empty while the stream runs.
    setInput('')
    onSend(text)
  }, [input, isBusy, onSend])

  const handleStop = useCallback(() => {
    onStop?.()
  }, [onStop])

  const plusMenuItems = useMemo<MenuProps['items']>(
    () => [
      {
        icon: LibraryBig,
        key: 'attachments',
        label: <MenuLabel chevron label='附件' />,
      },
      {
        icon: GlobeOff,
        key: 'search',
        label: <MenuLabel chevron label='联网搜索' />,
      },
      {
        icon: Settings2,
        key: 'params',
        label: <MenuLabel active label='高级参数' />,
      },
    ],
    [],
  )

  const plusMenuContent = useMemo(
    () => renderDropdownMenuItems(plusMenuItems),
    [plusMenuItems],
  )

  const canSend = Boolean(input.trim()) && !isBusy

  return (
    <Block className={styles.shell} padding={12} variant='outlined'>
      <textarea
        className={styles.input}
        placeholder='提问、创建或开始任务。使用 @ 分配任务给其他智能体。'
        rows={1}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            if (isBusy) return
            handleSend()
          }
        }}
      />

      <Flex align='center' justify='space-between' style={{ marginTop: 8 }}>
        <Flex align='center' gap={4}>
          <ModelSelector />
          {/*
            Compound DropdownMenu + native button trigger (multiple children).
            High-level <DropdownMenu><ActionIcon/></DropdownMenu> clones the child and
            reads element.ref, which React 19 warns about.
          */}
          <DropdownMenuRoot open={plusOpen} onOpenChange={setPlusOpen}>
            <DropdownMenuTrigger className={styles.plusTrigger} disabled={isBusy} nativeButton>
              <Icon icon={Plus} size={18} />
              <span className={styles.srOnly}>添加</span>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuPositioner placement='topLeft'>
                <DropdownMenuPopup className={styles.menuPopup}>{plusMenuContent}</DropdownMenuPopup>
              </DropdownMenuPositioner>
            </DropdownMenuPortal>
          </DropdownMenuRoot>
        </Flex>

        <SendButton
          disabled={!canSend}
          generating={isBusy}
          onClick={handleSend}
          onStop={handleStop}
        />
      </Flex>
    </Block>
  )
})

ChatInput.displayName = 'ChatInput'

export default ChatInput
