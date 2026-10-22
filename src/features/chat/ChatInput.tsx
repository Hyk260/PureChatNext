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
  Flex,
} from '@pure/ui'
import type { DropdownItem } from '@pure/ui'
import { toast, createStaticStyles, cssVar, cx } from '@lobehub/ui'
import { Check, ChevronRight, FileText, Globe, GlobeOff, LibraryBig, Plus, Settings2, X } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChatPermissionMode } from '@pure/types'

import { PURE_AI_AGENT_ID } from '@/const/home/agents'
import { CHAT_ATTACHMENT_ACCEPT, validateChatAttachments } from '@/features/chat/attachmentRules'
import ComposerImageAttachment from '@/features/chat/ComposerImageAttachment'
import ModelSelector from '@/features/chat/ModelSelector'
import { useCurrentHomeModel } from '@/features/chat/ModelSwitchMenu'
import PermissionModeSelector from '@/features/chat/PermissionModeSelector'
import SendButton from '@/features/chat/SendArea/SendButton'
import { EMPTY_DRAFT_FILES, getChatDraftKey, useChatDraftStore } from '@/features/chat/store/useChatDraftStore'
import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import type { ChatSearchMode } from '@/features/chat/types'
import { useImeEnterGuard } from '@/features/chat/useImeEnterGuard'
import HomeProjectBar from '@/features/home/components/HomeProjectBar'
import type { DesktopProject } from '@/types/desktop'

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
  // 保留 createStaticStyles：依赖尚无对应 Tailwind 语义 token 的主题或运行时变量。
  submenuChevron: css`
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
  // 保留 createStaticStyles：依赖尚无对应 Tailwind 语义 token 的主题或运行时变量。
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
}))

interface ChatInputProps {
  agentId?: string
  isBusy?: boolean
  onPermissionModeChange?: (mode: ChatPermissionMode) => Promise<void> | void
  onProjectChange?: (project: DesktopProject | null) => Promise<void> | void
  onSend: (text: string, files: File[]) => void | Promise<void>
  onSearchModeChange: (mode: ChatSearchMode) => void
  onStop?: () => void
  permissionMode?: ChatPermissionMode
  prefill?: string
  prefillKey?: number
  projectName?: string | null
  searchMode: ChatSearchMode
  topicId?: string | null
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
        <div className={cx(styles.toggleThumb, active && 'translate-x-3')} />
      </div>
    ) : chevron ? (
      <Icon className={cx(styles.submenuChevron, 'flex-none')} icon={ChevronRight} size={16} />
    ) : active ? (
      <Icon icon={Check} size={16} />
    ) : null}
  </div>
))

MenuLabel.displayName = 'MenuLabel'

const ChatInput = memo<ChatInputProps>((props) => {
  const {
    agentId = PURE_AI_AGENT_ID,
    isBusy,
    onPermissionModeChange,
    onProjectChange,
    onSearchModeChange,
    onSend,
    onStop,
    permissionMode,
    prefill,
    prefillKey,
    projectName,
    searchMode,
    topicId,
  } = props
  const draftKey = getChatDraftKey(agentId, topicId)
  const input = useChatDraftStore((state) => state.texts[draftKey] ?? '')
  const files = useChatDraftStore((state) => state.files[draftKey] ?? EMPTY_DRAFT_FILES)
  const setDraftText = useChatDraftStore((state) => state.setText)
  const setDraftFiles = useChatDraftStore((state) => state.setFiles)
  const setInput = useCallback((text: string) => setDraftText(draftKey, text), [draftKey, setDraftText])
  const setFiles = useCallback(
    (update: File[] | ((previous: File[]) => File[])) => setDraftFiles(draftKey, update),
    [draftKey, setDraftFiles]
  )
  const [plusOpen, setPlusOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const currentModel = useCurrentHomeModel()
  const rightCollapsed = useChatUiStore((s) => s.rightCollapsed)
  const openParamsPanel = useChatUiStore((s) => s.openParamsPanel)
  const { onCompositionEnd, onCompositionStart, shouldIgnoreEnter } = useImeEnterGuard()

  useEffect(() => {
    if (prefill) setInput(prefill)
    if (prefill || prefillKey) textareaRef.current?.focus()
  }, [prefill, prefillKey, setInput])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if ((!text && files.length === 0) || isBusy) return
    setInput('')
    const pendingFiles = files
    setFiles([])
    onSend(text, pendingFiles)
  }, [files, input, isBusy, onSend, setFiles, setInput])

  const handleAttachmentClick = useCallback(() => {
    setPlusOpen(false)
    fileInputRef.current?.click()
  }, [])

  const handleFilesSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(event.target.files ?? [])
      event.target.value = ''
      if (selected.length === 0) return

      const validationError = validateChatAttachments(selected, files.length)
      if (validationError) {
        toast.error(validationError)
        return
      }

      const imageFiles = selected.filter((file) => file.type.startsWith('image/'))
      if (imageFiles.length > 0 && !currentModel.abilities?.vision) {
        toast.error('当前模型不支持图片理解')
        return
      }

      setFiles((previous) => [...previous, ...selected])
    },
    [currentModel.abilities?.vision, files.length, setFiles]
  )

  const handleStop = useCallback(() => {
    onStop?.()
  }, [onStop])

  const handleToggleParams = useCallback(() => {
    openParamsPanel()
    setPlusOpen(false)
  }, [openParamsPanel])

  const handleSearchModeChange = useCallback(() => {
    onSearchModeChange(searchMode === 'auto' ? 'off' : 'auto')
  }, [onSearchModeChange, searchMode])

  const plusMenuItems = useMemo<DropdownItem[]>(
    () => [
      {
        icon: LibraryBig,
        key: 'attachments',
        label: <MenuLabel chevron label='附件' />,
        onClick: handleAttachmentClick,
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
        label: <MenuLabel active={!rightCollapsed} label='参数' />,
        onClick: handleToggleParams,
      },
    ],
    [handleAttachmentClick, handleSearchModeChange, handleToggleParams, isBusy, rightCollapsed, searchMode]
  )

  const plusMenuContent = useMemo(() => renderDropdownMenuItems(plusMenuItems), [plusMenuItems])

  const canSend = Boolean(input.trim() || files.length > 0) && !isBusy

  return (
    <Block padding={12} variant='outlined'>
      <input
        ref={fileInputRef}
        accept={CHAT_ATTACHMENT_ACCEPT}
        className='sr-only'
        disabled={isBusy}
        multiple
        type='file'
        onChange={handleFilesSelected}
      />

      {files.length > 0 ? (
        <Flex className='mb-3 gap-3 flex-wrap items-start pt-1.5'>
          {files.map((file, index) =>
            file.type.startsWith('image/') ? (
              <ComposerImageAttachment
                file={file}
                key={`${file.name}-${file.lastModified}-${index}`}
                onRemove={() => setFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index))}
              />
            ) : (
              <Flex
                className='items-center gap-1.5 max-w-[260px] rounded-lg p-[5px_8px]'
                key={`${file.name}-${file.lastModified}-${index}`}
                style={{ background: 'var(--lobe-color-fill-quaternary)' }}
              >
                <Icon icon={FileText} size={16} />
                <span className='truncate'>{file.name}</span>
                <button
                  aria-label={`删除 ${file.name}`}
                  className={styles.plusTrigger}
                  type='button'
                  onClick={() => setFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index))}
                >
                  <Icon icon={X} size={14} />
                </button>
              </Flex>
            )
          )}
        </Flex>
      ) : null}

      <textarea
        ref={textareaRef}
        className={styles.input}
        placeholder='随心输入'
        rows={1}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onCompositionEnd={onCompositionEnd}
        onCompositionStart={onCompositionStart}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey) return
          if (shouldIgnoreEnter(event)) return
          event.preventDefault()
          if (isBusy) return
          handleSend()
        }}
      />

      <Flex className='mt-2 flex-between'>
        <Flex className='items-center gap-1'>
          <ModelSelector />
          <DropdownMenuRoot open={plusOpen} onOpenChange={setPlusOpen}>
            <DropdownMenuTrigger className={styles.plusTrigger} disabled={isBusy} nativeButton>
              <Icon icon={Plus} size={18} />
              <span className='sr-only'>添加</span>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuPositioner placement='topLeft'>
                <DropdownMenuPopup className={'min-w-[220px]'}>{plusMenuContent}</DropdownMenuPopup>
              </DropdownMenuPositioner>
            </DropdownMenuPortal>
          </DropdownMenuRoot>
          {permissionMode && onPermissionModeChange ? (
            <PermissionModeSelector
              disabled={isBusy}
              value={permissionMode}
              onChange={onPermissionModeChange}
            />
          ) : null}
          {onProjectChange && !topicId ? (
            <HomeProjectBar
              disabled={isBusy}
              projectName={projectName ?? null}
              value={null}
              onChange={onProjectChange}
            />
          ) : null}
        </Flex>

        <SendButton generating={isBusy} onClick={handleSend} onStop={handleStop} />
      </Flex>
    </Block>
  )
})

ChatInput.displayName = 'ChatInput'

export default ChatInput
