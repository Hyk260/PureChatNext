'use client'

import {
  ActionIcon,
  Block,
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  Flexbox,
  Icon,
  renderDropdownMenuItems,
} from '@pure/ui'
import type { MenuProps } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { FileText, Paperclip, Plus, X } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
import mechaCat from '@/assets/mascots/purechat-mecha-cat.png'
import { DEFAULT_PURE_AI_META, PURE_AI_AGENT_ID } from '@/const/home/agents'
import { CHAT_ATTACHMENT_ACCEPT, validateChatAttachments } from '@/features/chat/attachmentRules'
import { setPendingChatFiles, setPendingChatText } from '@/features/chat/chatLocalStorage'
import { useCurrentHomeModel } from '@/features/chat/ModelSwitchMenu'
import SendArea from '@/features/chat/SendArea'
import { useImeEnterGuard } from '@/features/chat/useImeEnterGuard'
import HomeAgentSelect from '@/features/home/components/HomeAgentSelect'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import { trackAcquisitionEvent } from '@/libs/analytics/acquisition'
import { useRouter } from '@/utils/navigation'

const mechaCatSrc = typeof mechaCat === 'string' ? mechaCat : mechaCat.src

const styles = createStaticStyles(({ css }) => ({
  input: css`
    width: 100%;
    min-height: 50px;
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
  shell: css`
    position: relative;
    overflow: visible;
    border-radius: 20px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.04);
  `,
  mascot: css`
    pointer-events: none;
    position: absolute;
    z-index: 1;
    inset-block-start: -82px;
    inset-inline-end: 26px;
    width: 100px;
    height: auto;
    filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.12));

    @media (max-width: 600px) {
      inset-block-start: -58px;
      inset-inline-end: 12px;
      width: 88px;
    }

    @container (max-width: 360px) {
      inset-block-start: -48px;
      inset-inline-end: 8px;
      width: 72px;
    }
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
  attachment: css`
    max-width: 260px;
    padding: 5px 8px;
    border-radius: 8px;
    background: ${cssVar.colorFillQuaternary};
  `,
  footer: css`
    @container (max-width: 360px) {
      gap: 8px;
    }
  `,
  menuPopup: css`
    min-width: 220px;
  `,
  modelLabel: css`
    @container (max-width: 360px) {
      display: none;
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

    &:hover,
    &[data-popup-open] {
      background: ${cssVar.colorFillSecondary};
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
  `,
}))

const AttachmentImagePreview = memo<{ file: File }>(({ file }) => {
  const [source] = useState(() => URL.createObjectURL(file))

  useEffect(() => () => URL.revokeObjectURL(source), [source])

  return <img alt='' height={28} src={source} style={{ borderRadius: 4, objectFit: 'cover', width: 28 }} />
})

AttachmentImagePreview.displayName = 'AttachmentImagePreview'

const HomeChatInput = memo(() => {
  const { message } = useApp()
  const router = useRouter()
  const [input, setInput] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [plusOpen, setPlusOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentModel = useCurrentHomeModel()
  const { onCompositionEnd, onCompositionStart, shouldIgnoreEnter } = useImeEnterGuard()
  const selectedAgentId = useHomeStore((s) => s.selectedAgentId)
  const activeAgent = useHomeStore((s) => s.activeAgent)
  const setActiveAgent = useHomeStore((s) => s.setActiveAgent)

  const agents = useAgentsStore((s) => s.agents)
  const fetchAgentsList = useAgentsStore((s) => s.fetchAgents)
  const canSend = Boolean(input.trim() || files.length > 0) && !sending

  useEffect(() => {
    fetchAgentsList()
  }, [fetchAgentsList])

  const handleFilesSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(event.target.files ?? [])
      event.target.value = ''
      if (selected.length === 0) return

      const validationError = validateChatAttachments(selected, files.length)
      if (validationError) {
        message.error(validationError)
        return
      }

      if (selected.some((file) => file.type.startsWith('image/')) && !currentModel.abilities?.vision) {
        message.error('当前模型不支持图片理解')
        return
      }

      setFiles((previous) => [...previous, ...selected])
    },
    [currentModel.abilities?.vision, files.length, message]
  )

  const handleAttachmentClick = useCallback(() => {
    setPlusOpen(false)
    fileInputRef.current?.click()
  }, [])

  const handleAgentSelected = useCallback(() => {
    setPlusOpen(false)
  }, [])

  const plusMenuItems = useMemo<MenuProps['items']>(
    () => [
      {
        icon: Paperclip,
        key: 'attachments',
        label: '上传附件',
        onClick: handleAttachmentClick,
      },
    ],
    [handleAttachmentClick]
  )

  const plusMenuContent = useMemo(() => renderDropdownMenuItems(plusMenuItems), [plusMenuItems])

  const handleSend = () => {
    const text = input.trim()
    if ((!text && files.length === 0) || sending) return

    setSending(true)

    try {
      const agentId = selectedAgentId || PURE_AI_AGENT_ID
      const listed = agents.find((agent) => agent.id === agentId)

      if (listed) {
        setActiveAgent({
          avatar: listed.avatar,
          identifier: listed.id,
          systemRole: listed.systemRole,
          title: listed.title,
        })
      } else if (activeAgent?.identifier !== agentId) {
        const fallback = agents[0] ?? DEFAULT_PURE_AI_META
        setActiveAgent({
          avatar: fallback.avatar,
          identifier: fallback.id,
          systemRole: fallback.systemRole,
          title: fallback.title,
        })
      }

      setPendingChatText(text)
      setPendingChatFiles(files)
      trackAcquisitionEvent('chat_intent', {
        agent: agentId,
        attachment_count: files.length,
        provider: currentModel.provider,
      })
      setInput('')
      setFiles([])
      router.push(`/chat?agent=${encodeURIComponent(agentId)}`)
    } catch (error) {
      console.error('[home] start chat failed:', error)
      message.error('无法开始对话')
      setSending(false)
    }
  }

  return (
    <Block className={styles.shell} padding={12} variant='outlined'>
      <img alt='' aria-hidden className={styles.mascot} src={mechaCatSrc} />
      <input
        ref={fileInputRef}
        accept={CHAT_ATTACHMENT_ACCEPT}
        className={styles.srOnly}
        disabled={sending}
        multiple
        type='file'
        onChange={handleFilesSelected}
      />

      {files.length > 0 ? (
        <Flexbox horizontal gap={8} style={{ flexWrap: 'wrap', marginBottom: 10 }}>
          {files.map((file, index) => (
            <Flexbox
              horizontal
              align='center'
              className={styles.attachment}
              gap={6}
              key={`${file.name}-${file.lastModified}-${index}`}
            >
              {file.type.startsWith('image/') ? (
                <AttachmentImagePreview file={file} />
              ) : (
                <Icon icon={FileText} size={16} />
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
              <ActionIcon
                icon={X}
                size={{ blockSize: 24, size: 14 }}
                title={`删除 ${file.name}`}
                onClick={() => setFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index))}
              />
            </Flexbox>
          ))}
        </Flexbox>
      ) : null}

      <textarea
        className={styles.input}
        placeholder='随心输入'
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onCompositionEnd={onCompositionEnd}
        onCompositionStart={onCompositionStart}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey) return
          if (shouldIgnoreEnter(event)) return
          event.preventDefault()
          handleSend()
        }}
      />

      <Flexbox horizontal align='center' className={styles.footer} justify='space-between' style={{ marginTop: 12 }}>
        <Flexbox horizontal align='center' gap={8}>
          <DropdownMenuRoot open={plusOpen} onOpenChange={setPlusOpen}>
            <DropdownMenuTrigger className={styles.plusTrigger} disabled={sending} nativeButton>
              <Icon icon={Plus} size={18} />
              <span className={styles.srOnly}>添加</span>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuPositioner placement='topLeft'>
                <DropdownMenuPopup className={styles.menuPopup}>
                  <HomeAgentSelect onSelect={handleAgentSelected} />
                  {plusMenuContent}
                </DropdownMenuPopup>
              </DropdownMenuPositioner>
            </DropdownMenuPortal>
          </DropdownMenuRoot>
        </Flexbox>

        <SendArea
          disabled={!canSend}
          loading={sending}
          modelLabelClassName={styles.modelLabel}
          onClick={handleSend}
        />
      </Flexbox>
    </Block>
  )
})

HomeChatInput.displayName = 'HomeChatInput'

export default HomeChatInput
