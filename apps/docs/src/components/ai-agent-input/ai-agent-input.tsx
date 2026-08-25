'use client'

import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import {
  ArrowUp,
  BookOpen,
  Check,
  ChevronRight,
  Image as ImageIcon,
  LoaderCircle,
  Paperclip,
  Plus,
  Square,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import styles from './ai-agent-input.module.css'

const models = [
  { id: 'gpt-5.4-mini', name: 'GPT 5.4 Mini', description: '适合通用问答与工具调用。' },
  { id: 'gpt-5.2', name: 'GPT 5.2', description: '适合复杂推理与多轮追问。' },
  // { id: 'qwen3.5-plus', name: 'Qwen 3.5 Plus', description: '适合长文档与大上下文检索。' },
]

function ModelIcon({ id }: { id: string }) {
  if (id.startsWith('gpt')) {
    return (
      <svg aria-hidden='true' fill='currentColor' height='12' viewBox='0 0 320 320' width='12'>
        <path d='m297.06 130.97c7.26-21.79 4.76-45.66-6.85-65.48-17.46-30.4-52.56-46.04-86.84-38.68-15.25-17.18-37.16-26.95-60.13-26.81-35.04-.08-66.13 22.48-76.91 55.82-22.51 4.61-41.94 18.7-53.31 38.67-17.59 30.32-13.58 68.54 9.92 94.54-7.26 21.79-4.76 45.66 6.85 65.48 17.46 30.4 52.56 46.04 86.84 38.68 15.24 17.18 37.16 26.95 60.13 26.8 35.06.09 66.16-22.49 76.94-55.86 22.51-4.61 41.94-18.7 53.31-38.67 17.57-30.32 13.55-68.51-9.94-94.51zm-120.28 168.11c-14.03.02-27.62-4.89-38.39-13.88.49-.26 1.34-.73 1.89-1.07l63.72-36.8c3.26-1.85 5.26-5.32 5.24-9.07v-89.83l26.93 15.55c.29.14.48.42.52.74v74.39c-.04 33.08-26.83 59.9-59.91 59.97zm-128.84-55.03c-7.03-12.14-9.56-26.37-7.15-40.18.47.28 1.3.79 1.89 1.13l63.72 36.8c3.23 1.89 7.23 1.89 10.47 0l77.79-44.92v31.1c.02.32-.13.63-.38.83l-64.41 37.19c-28.69 16.52-65.33 6.7-81.92-21.95zm-16.77-139.09c7-12.16 18.05-21.46 31.21-26.29 0 .55-.03 1.52-.03 2.2v73.61c-.02 3.74 1.98 7.21 5.23 9.06l77.79 44.91-26.93 15.55c-.27.18-.61.21-.91.08l-64.42-37.22c-28.63-16.58-38.45-53.21-21.95-81.89zm221.26 51.49-77.79-44.92 26.93-15.54c.27-.18.61-.21.91-.08l64.42 37.19c28.68 16.57 38.51 53.26 21.94 81.94-7.01 12.14-18.05 21.44-31.2 26.28v-75.81c.03-3.74-1.96-7.2-5.2-9.06zm26.8-40.34c-.47-.29-1.3-.79-1.89-1.13l-63.72-36.8c-3.23-1.89-7.23-1.89-10.47 0l-77.79 44.92v-31.1c-.02-.32.13-.63.38-.83l64.41-37.16c28.69-16.55 65.37-6.7 81.91 22 6.99 12.12 9.52 26.31 7.15 40.1zm-168.51 55.43-26.94-15.55c-.29-.14-.48-.42-.52-.74v-74.39c.02-33.12 26.89-59.96 60.01-59.94 14.01 0 27.57 4.92 38.34 13.88-.49.26-1.33.73-1.89 1.07l-63.72 36.8c-3.26 1.85-5.26 5.31-5.24 9.06l-.04 89.79zm14.63-31.54 34.65-20.01 34.65 20v40.01l-34.65 20-34.65-20z' />
      </svg>
    )
  }

  return (
    <svg aria-hidden='true' fill='none' height='12' viewBox='0 0 16 16' width='12'>
      <path
        d='M16 8.016A8.522 8.522 0 0 0 8.016 16h-.032A8.521 8.521 0 0 0 0 8.016v-.032A8.521 8.521 0 0 0 7.984 0h.032A8.522 8.522 0 0 0 16 7.984v.032z'
        fill='url(#pi-gemini-grad)'
      />
      <defs>
        <radialGradient
          cx='0'
          cy='0'
          gradientTransform='matrix(16.1326 5.4553 -43.70045 129.2322 1.588 6.503)'
          gradientUnits='userSpaceOnUse'
          id='pi-gemini-grad'
          r='1'
        >
          <stop offset='.067' stopColor='#9168C0' />
          <stop offset='.343' stopColor='#5684D1' />
          <stop offset='.672' stopColor='#1BA1E3' />
        </radialGradient>
      </defs>
    </svg>
  )
}

const skills = [
  { id: 'deep-research', name: 'Deep Research', description:'深度搜索，根据问题提供相关文档链接和答案' },
  { id: 'code-review', name: 'Code Review', description:'代码审查，根据问题提供相关代码链接和答案' },
  { id: 'web-search', name: 'Web Search', description:'网络搜索，根据问题提供相关网络链接和答案' },
  { id: 'summarize', name: 'Summarize', description:'总结，根据问题提供相关总结和答案' },
]

type Attachment = {
  id: number
  kind: 'file' | 'image'
  name: string
}

type Phase = 'idle' | 'enhancing' | 'enhanced'

export type AIAgentInputProps = {
  maxLength?: number
  onStop: () => void
  onSubmit: (text: string) => void
  pending: boolean
  resetKey: number
}

function getTextWithoutSkills(editor: HTMLElement) {
  const clone = editor.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-skill-pill]').forEach((pill) => pill.remove())
  return (clone.textContent ?? '').replace(/\u00a0/g, ' ')
}

function getSkillName(id: string) {
  return skills.find((skill) => skill.id === id)?.name ?? id
}

function buildSkillPill(id: string) {
  const pill = document.createElement('span')
  pill.className = styles.skillPill
  pill.dataset.skillPill = id
  pill.setAttribute('contenteditable', 'false')

  const label = document.createElement('span')
  label.className = styles.skillPillLabel
  label.textContent = `/${getSkillName(id)}`

  const remove = document.createElement('button')
  remove.className = styles.skillPillX
  remove.dataset.skillRemove = 'true'
  remove.type = 'button'
  remove.setAttribute('aria-label', `移除 ${getSkillName(id)}`)
  remove.innerHTML =
    '<svg aria-hidden="true" fill="none" height="11" viewBox="0 0 24 24" width="11"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"/></svg>'

  pill.append(label, remove)
  return pill
}

export function AIAgentInput({ maxLength = 1000, onStop, onSubmit, pending, resetKey }: AIAgentInputProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const plusRef = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const enhanceTimerRef = useRef<number | null>(null)
  const nextAttachmentId = useRef(1)
  const originalPromptRef = useRef('')
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [enhancePhase, setEnhancePhase] = useState<Phase>('idle')
  const [menuOpen, setMenuOpen] = useState(false)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [model, setModel] = useState(models[0].id)
  const [modelDescription, setModelDescription] = useState<string | null>(null)
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [slashIndex, setSlashIndex] = useState(0)
  const [enhanceError, setEnhanceError] = useState(false)

  const slashResults = skills.filter((skill) => skill.name.toLowerCase().includes(slashQuery.toLowerCase()))
  const enhancing = enhancePhase === 'enhancing'
  const hasText = value.trim().length > 0
  const sendActive = hasText && !pending && !enhancing && value.length <= maxLength

  function focusEditorEnd() {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    savedRangeRef.current = range.cloneRange()
  }

  function syncValue() {
    const editor = editorRef.current
    if (!editor) return
    const nextValue = getTextWithoutSkills(editor)
    if (nextValue.length > maxLength) {
      editor.textContent = nextValue.slice(0, maxLength)
      setValue(nextValue.slice(0, maxLength))
      focusEditorEnd()
      return
    }
    setValue(nextValue)
  }

  function setEditorText(text: string) {
    const editor = editorRef.current
    if (!editor) return
    editor.textContent = text
    setValue(text)
    requestAnimationFrame(focusEditorEnd)
  }

  function closeSlashMenu() {
    setSlashOpen(false)
    setSlashQuery('')
    setSlashIndex(0)
  }

  function detectSlashCommand() {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection?.rangeCount || !selection.isCollapsed) {
      closeSlashMenu()
      return
    }

    const range = selection.getRangeAt(0)
    const node = range.startContainer
    if (node.nodeType !== Node.TEXT_NODE || !editor.contains(node)) {
      closeSlashMenu()
      return
    }

    const beforeCaret = (node.textContent ?? '').slice(0, range.startOffset)
    const match = beforeCaret.match(/(?:^|\s)\/([^\s/]*)$/)
    if (!match) {
      closeSlashMenu()
      return
    }

    setSlashQuery(match[1])
    setSlashIndex(0)
    setSlashOpen(true)
  }

  function saveSelection() {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (editor && selection?.rangeCount && editor.contains(selection.anchorNode)) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange()
    }
  }

  function insertSkill(id: string) {
    const editor = editorRef.current
    if (!editor) return

    let range = savedRangeRef.current?.cloneRange() ?? null
    const selection = window.getSelection()
    if (selection?.rangeCount && editor.contains(selection.anchorNode)) range = selection.getRangeAt(0).cloneRange()

    if (!range) {
      range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
    }

    const node = range.startContainer
    if (node.nodeType === Node.TEXT_NODE) {
      const beforeCaret = (node.textContent ?? '').slice(0, range.startOffset)
      const match = beforeCaret.match(/(?:^|\s)\/([^\s/]*)$/)
      if (match) {
        range.setStart(node, range.startOffset - match[0].length)
        range.deleteContents()
      }
    }

    const pill = buildSkillPill(id)
    range.insertNode(pill)
    const separator = document.createTextNode('\u00a0')
    pill.after(separator)
    const after = document.createRange()
    after.setStartAfter(separator)
    after.collapse(true)
    const nextSelection = window.getSelection()
    nextSelection?.removeAllRanges()
    nextSelection?.addRange(after)
    savedRangeRef.current = after.cloneRange()
    syncValue()
    closeSlashMenu()
    setMenuOpen(false)
    setSkillsOpen(false)
    setModelDescription(null)
  }

  function removeSkill(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    const removeButton = target.closest('[data-skill-remove]')
    if (!removeButton) {
      saveSelection()
      return
    }

    event.preventDefault()
    const pill = removeButton.closest('[data-skill-pill]')
    if (!pill) return
    const separator = pill.nextSibling
    pill.remove()
    if (separator?.nodeType === Node.TEXT_NODE && separator.textContent?.startsWith('\u00a0')) {
      separator.textContent = separator.textContent.slice(1)
      if (!separator.textContent) separator.parentNode?.removeChild(separator)
    }
    syncValue()
    focusEditorEnd()
  }

  function submit() {
    if (!sendActive) return
    const text = value.trim()
    onSubmit(text)
    resetEditor()
  }

  function resetEditor() {
    const editor = editorRef.current
    if (editor) editor.replaceChildren()
    setValue('')
    setAttachments([])
    setEnhancePhase('idle')
    setEnhanceError(false)
    originalPromptRef.current = ''
    closeSlashMenu()
  }

  function enhancePrompt() {
    if (!hasText || enhancing) return
    const prompt = value.trim()
    originalPromptRef.current = prompt
    setEnhanceError(false)
    setEnhancePhase('enhancing')
    enhanceTimerRef.current = window.setTimeout(() => {
      try {
        setEditorText(`请基于 PureChatNext 公开文档回答以下问题，并给出清晰的操作步骤和相关文档链接：\n${prompt}`)
        setEnhancePhase('enhanced')
      } catch {
        setEnhanceError(true)
        setEnhancePhase('idle')
      }
    }, 650)
  }

  function revertPrompt() {
    if (!originalPromptRef.current) return
    if (enhanceTimerRef.current) window.clearTimeout(enhanceTimerRef.current)
    setEditorText(originalPromptRef.current)
    setEnhancePhase('idle')
  }

  function openPicker(kind: Attachment['kind']) {
    const input = fileRef.current
    if (!input) return
    input.accept = kind === 'image' ? 'image/*' : '*/*'
    input.dataset.kind = kind
    input.value = ''
    input.click()
    setMenuOpen(false)
    setSkillsOpen(false)
    setModelDescription(null)
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (slashOpen && slashResults.length) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        setSlashIndex(
          (index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + slashResults.length) % slashResults.length
        )
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        insertSkill(slashResults[slashIndex]?.id ?? slashResults[0].id)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        closeSlashMenu()
        return
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  useEffect(() => {
    if (!menuOpen) return
    function handlePointerDown(event: PointerEvent) {
      if (!plusRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
        setSkillsOpen(false)
        setModelDescription(null)
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setSkillsOpen(false)
        setModelDescription(null)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menuOpen])

  useEffect(() => {
    return () => {
      if (enhanceTimerRef.current) window.clearTimeout(enhanceTimerRef.current)
    }
  }, [])

  return (
    <div className={styles.wrap} data-reset-key={resetKey}>
      <input
        ref={fileRef}
        className={styles.hiddenInput}
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          if (!files.length) return
          const fallback = (event.target.dataset.kind as Attachment['kind']) ?? 'file'
          setAttachments((current) => [
            ...current,
            ...files.map((file) => ({
              id: nextAttachmentId.current++,
              kind: file.type.startsWith('image/') ? 'image' : fallback,
              name: file.name,
            })),
          ])
          event.target.value = ''
          requestAnimationFrame(focusEditorEnd)
        }}
        type='file'
      />

      <div className={styles.frame} data-enhancing={enhancing || undefined} data-pending={pending || undefined}>
        {attachments.length ? (
          <div className={styles.chips}>
            {attachments.map((attachment) => (
              <span className={styles.chip} key={attachment.id}>
                <span className={styles.chipIcon}>
                  {attachment.kind === 'image' ? (
                    <ImageIcon aria-hidden className='size-3.5' />
                  ) : (
                    <Paperclip aria-hidden className='size-3.5' />
                  )}
                </span>
                <span className={styles.chipName}>{attachment.name}</span>
                <button
                  aria-label={`移除 ${attachment.name}`}
                  className={styles.chipRemove}
                  onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                  type='button'
                >
                  <X aria-hidden className='size-3' />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className={styles.editorWrap}>
          {enhancing ? (
            <div aria-live='polite' className={styles.enhancingText}>
              {value}
            </div>
          ) : (
            <div
              aria-disabled={pending}
              aria-label='Ask AI Agent'
              className={styles.field}
              contentEditable={!pending}
              data-empty={!hasText || undefined}
              data-placeholder='Ask AI Agent'
              onBlur={saveSelection}
              onClick={removeSkill}
              onInput={() => {
                syncValue()
                if (enhancePhase === 'enhanced') setEnhancePhase('idle')
                detectSlashCommand()
              }}
              onKeyDown={handleKeyDown}
              onKeyUp={saveSelection}
              ref={editorRef}
              role='textbox'
              suppressContentEditableWarning
            />
          )}

          {slashOpen && !enhancing ? (
            <div aria-label='Skills' className={styles.slashMenu} role='listbox'>
              <div className={styles.menuLabel}>Skills</div>
              {slashResults.length ? (
                slashResults.map((skill, index) => (
                  <button
                    aria-selected={index === slashIndex}
                    className={`${styles.menuItem} ${index === slashIndex ? styles.menuItemActive : ''}`}
                    key={skill.id}
                    onClick={() => insertSkill(skill.id)}
                    onMouseDown={(event) => event.preventDefault()}
                    role='option'
                    type='button'
                  >
                    <span className={styles.menuName}>{skill.name}</span>
                  </button>
                ))
              ) : (
                <div className={styles.slashEmpty}>No matching skills</div>
              )}
            </div>
          ) : null}
        </div>

        <div className={styles.row}>
          <div className={styles.plusWrap} ref={plusRef}>
            <button
              aria-expanded={menuOpen}
              aria-label='添加附件或切换模型'
              className={`${styles.iconBtn} ${styles.plus}`}
              data-open={menuOpen || undefined}
              onClick={() => {
                if (menuOpen) {
                  setMenuOpen(false)
                  setSkillsOpen(false)
                  setModelDescription(null)
                } else {
                  setMenuOpen(true)
                }
              }}
              type='button'
            >
              <span className={styles.plusIcon}>
                <Plus aria-hidden className='size-3.5' />
              </span>
            </button>

            {menuOpen ? (
              <div className={styles.menu} role='menu'>
                <button className={styles.menuItem} onClick={() => openPicker('image')} role='menuitem' type='button'>
                  <span className={styles.menuIcon}>
                    <ImageIcon aria-hidden className='size-3.5' />
                  </span>
                  <span className={styles.menuName}>添加图片</span>
                </button>
                <button className={styles.menuItem} onClick={() => openPicker('file')} role='menuitem' type='button'>
                  <span className={styles.menuIcon}>
                    <Paperclip aria-hidden className='size-3.5' />
                  </span>
                  <span className={styles.menuName}>添加文件</span>
                </button>
                <div className={styles.menuDivider} />
                <div className={styles.menuSub}>
                  <button
                    aria-expanded={skillsOpen}
                    className={styles.menuItem}
                    onClick={() => setSkillsOpen((open) => !open)}
                    role='menuitem'
                    type='button'
                  >
                    <span className={styles.menuIcon}>
                      <BookOpen aria-hidden className='size-3.5' />
                    </span>
                    <span className={styles.menuName}>Skills</span>
                    <ChevronRight aria-hidden className={`${styles.menuChevron} size-3.5`} />
                  </button>
                  {skillsOpen ? (
                    <div className={styles.menuFlyout} role='menu'>
                      {skills.map((skill) => (
                        <button
                          className={styles.menuItem}
                          key={skill.id}
                          onClick={() => insertSkill(skill.id)}
                          role='menuitem'
                          type='button'
                        >
                          <span className={styles.menuName}>{skill.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className={styles.menuDivider} />
                <div className={styles.menuLabel}>Model</div>
                {models.map((item) => (
                  <div
                    className={styles.menuSub}
                    key={item.id}
                    onMouseEnter={() => setModelDescription(item.id)}
                    onMouseLeave={() => setModelDescription(null)}
                  >
                    <button
                      aria-checked={model === item.id}
                      className={styles.menuItem}
                      onClick={() => {
                        setModel(item.id)
                        setMenuOpen(false)
                        setSkillsOpen(false)
                        setModelDescription(null)
                      }}
                      role='menuitemradio'
                      type='button'
                    >
                      <span className={styles.menuBrand}>
                        <ModelIcon id={item.id} />
                      </span>
                      <span className={styles.menuName}>{item.name}</span>
                      {model === item.id ? <Check aria-hidden className={`${styles.menuCheck} size-3.5`} /> : null}
                    </button>
                    {modelDescription === item.id ? (
                      <div className={styles.menuPopover} role='tooltip'>
                        {item.description}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className={styles.right}>
            {enhancing ? (
              <span aria-label='正在增强提示词' className={`${styles.iconBtn} ${styles.spinnerBtn}`}>
                <LoaderCircle aria-hidden className={`${styles.spinner} size-3.5`} />
              </span>
            ) : hasText ? (
              <button
                className={styles.pill}
                onClick={enhancePhase === 'enhanced' ? revertPrompt : enhancePrompt}
                type='button'
              >
                {enhancePhase === 'enhanced' ? '还原' : '增强提示词'}
              </button>
            ) : null}
            {pending ? (
              <button
                aria-label='停止生成'
                className={`${styles.iconBtn} ${styles.send} ${styles.sendActive}`}
                onClick={onStop}
                type='button'
              >
                <Square aria-hidden className='size-3.5 fill-current' />
              </button>
            ) : (
              <button
                aria-label='发送问题'
                className={`${styles.iconBtn} ${styles.send} ${sendActive ? styles.sendActive : ''}`}
                disabled={!sendActive}
                onClick={submit}
                type='button'
              >
                <ArrowUp aria-hidden className='size-3.5' />
              </button>
            )}
          </div>
        </div>
      </div>
      {enhanceError ? <p className={styles.enhanceError}>提示词增强失败，请重试。</p> : null}
    </div>
  )
}
