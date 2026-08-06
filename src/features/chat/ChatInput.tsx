'use client'

import {
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  renderDropdownMenuItems,
  Block,
  Icon,
  Flexbox,
} from '@pure/ui'
import type { MenuProps } from '@pure/ui'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import { Check, ChevronRight, Globe, GlobeOff, LibraryBig, Plus, Settings2 } from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'

import ModelSelector from '@/features/chat/ModelSelector'
import { SendButton } from '@/features/chat/SendArea'
import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import type { ChatSearchMode } from '@/features/chat/types'

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
  toggle: css`
    position: relative;
    flex: none;
    width: 28px;
    height: 16px;
    border-radius: 8px;
    background: ${cssVar.colorFillSecondary};
    transition: background-color 0.2s;
  `,
  toggleActive: css`
    background: ${cssVar.colorPrimary};
  `,
  toggleThumb: css`
    position: absolute;
    inset-block-start: 2px;
    inset-inline-start: 2px;

    width: 12px;
    height: 12px;
    border-radius: 50%;

    background: ${cssVar.colorBgContainer};
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);

    transition: transform 0.2s;
  `,
  toggleThumbActive: css`
    transform: translateX(12px);
  `,
}))

interface ChatInputProps {
  isBusy?: boolean
  onSend: (text: string) => void | Promise<void>
  onSearchModeChange: (mode: ChatSearchMode) => void
  onStop?: () => void
  searchMode: ChatSearchMode
}

const MenuLabel = memo<{
  active?: boolean
  chevron?: boolean
  label: string
  toggle?: boolean
}>(({ label, chevron, active, toggle }) => (
  <div className={styles.menuLabel}>
    <span>{label}</span>
    {toggle ? (
      <div aria-hidden className={cx(styles.toggle, active && styles.toggleActive)}>
        <div className={cx(styles.toggleThumb, active && styles.toggleThumbActive)} />
      </div>
    ) : chevron ? (
      <Icon className={styles.submenuChevron} icon={ChevronRight} size={16} />
    ) : active ? (
      <Icon icon={Check} size={16} />
    ) : null}
  </div>
))

MenuLabel.displayName = 'MenuLabel'

const ChatInput = memo<ChatInputProps>(({ isBusy, onSearchModeChange, onSend, onStop, searchMode }) => {
  const [input, setInput] = useState('')
  const [plusOpen, setPlusOpen] = useState(false)
  const rightCollapsed = useChatUiStore((s) => s.rightCollapsed)
  const toggleRightCollapsed = useChatUiStore((s) => s.toggleRightCollapsed)

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || isBusy) return
    setInput('')
    onSend(text)
  }, [input, isBusy, onSend])

  const handleStop = useCallback(() => {
    onStop?.()
  }, [onStop])

  const handleToggleParams = useCallback(() => {
    toggleRightCollapsed()
    setPlusOpen(false)
  }, [toggleRightCollapsed])

  const handleSearchModeChange = useCallback(() => {
    onSearchModeChange(searchMode === 'auto' ? 'off' : 'auto')
  }, [onSearchModeChange, searchMode])

  const plusMenuItems = useMemo<MenuProps['items']>(
    () => [
      {
        icon: LibraryBig,
        key: 'attachments',
        label: <MenuLabel chevron label='附件' />,
      },
      {
        disabled: isBusy,
        icon: searchMode === 'auto' ? Globe : GlobeOff,
        key: 'search',
        label: <MenuLabel active={searchMode === 'auto'} label='联网搜索' toggle />,
        onClick: handleSearchModeChange,
      },
      {
        icon: Settings2,
        key: 'params',
        label: <MenuLabel active={!rightCollapsed} label='高级参数' />,
        onClick: handleToggleParams,
      },
    ],
    [handleSearchModeChange, handleToggleParams, isBusy, rightCollapsed, searchMode]
  )

  const plusMenuContent = useMemo(() => renderDropdownMenuItems(plusMenuItems), [plusMenuItems])

  const canSend = Boolean(input.trim()) && !isBusy

  return (
    <Block className={styles.shell} padding={12} variant='outlined'>
      <textarea
        className={styles.input}
        placeholder='随心输入'
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

      <Flexbox horizontal align='center' justify='space-between' style={{ marginTop: 8 }}>
        <Flexbox horizontal align='center' gap={4}>
          <ModelSelector />
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
        </Flexbox>

        <SendButton disabled={!canSend} generating={isBusy} onClick={handleSend} onStop={handleStop} />
      </Flexbox>
    </Block>
  )
})

ChatInput.displayName = 'ChatInput'

export default ChatInput
