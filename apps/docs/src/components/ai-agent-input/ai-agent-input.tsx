'use client'

import type {
  ClipboardEvent as ReactClipboardEvent,
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react'
import { ArrowUp, BookOpen, Check, ChevronRight, LoaderCircle, Plus, Square } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { AskAIModelId, AskAISkillId } from '@/lib/ask-ai-config'
import { ASK_AI_MODELS, ASK_AI_SKILL_IDS, ASK_AI_SKILLS } from '@/lib/ask-ai-config'
import { addUniqueSkill, clipInsertedText, findSlashToken, isEditorVisuallyEmpty } from './ai-agent-input-logic'
import styles from './ai-agent-input.module.css'

type Phase = 'enhanced' | 'enhancing' | 'idle'

type EditorSnapshot = {
  skills: AskAISkillId[]
  text: string
}

type LastValidEditor = EditorSnapshot & {
  nodes: Node[]
}

type SlashRange = {
  end: number
  node: Text
  start: number
}

export type AIAgentInputSubmit = {
  skills: AskAISkillId[]
  text: string
}

export type AIAgentInputProps = {
  maxLength?: number
  model: AskAIModelId
  onEnhance?: (text: string, signal: AbortSignal) => Promise<string>
  onModelChange: (model: AskAIModelId) => void
  onStop: () => void
  onSubmit: (submission: AIAgentInputSubmit) => void
  pending: boolean
  resetKey: number
}

const skillIdSet = new Set<string>(ASK_AI_SKILL_IDS)

function ModelIcon({ brand }: { brand: (typeof ASK_AI_MODELS)[number]['brand'] }) {
  const gradientId = `pi-qwen-${useId().replaceAll(':', '')}`

  if (brand === 'openai') {
    return (
      <svg aria-hidden='true' fill='currentColor' height='12' viewBox='0 0 320 320' width='12'>
        <path d='m297.06 130.97c7.26-21.79 4.76-45.66-6.85-65.48-17.46-30.4-52.56-46.04-86.84-38.68-15.25-17.18-37.16-26.95-60.13-26.81-35.04-.08-66.13 22.48-76.91 55.82-22.51 4.61-41.94 18.7-53.31 38.67-17.59 30.32-13.58 68.54 9.92 94.54-7.26 21.79-4.76 45.66 6.85 65.48 17.46 30.4 52.56 46.04 86.84 38.68 15.24 17.18 37.16 26.95 60.13 26.8 35.06.09 66.16-22.49 76.94-55.86 22.51-4.61 41.94-18.7 53.31-38.67 17.57-30.32 13.55-68.51-9.94-94.51zm-120.28 168.11c-14.03.02-27.62-4.89-38.39-13.88.49-.26 1.34-.73 1.89-1.07l63.72-36.8c3.26-1.85 5.26-5.32 5.24-9.07v-89.83l26.93 15.55c.29.14.48.42.52.74v74.39c-.04 33.08-26.83 59.9-59.91 59.97zm-128.84-55.03c-7.03-12.14-9.56-26.37-7.15-40.18.47.28 1.3.79 1.89 1.13l63.72 36.8c3.23 1.89 7.23 1.89 10.47 0l77.79-44.92v31.1c.02.32-.13.63-.38.83l-64.41 37.19c-28.69 16.52-65.33 6.7-81.92-21.95zm-16.77-139.09c7-12.16 18.05-21.46 31.21-26.29 0 .55-.03 1.52-.03 2.2v73.61c-.02 3.74 1.98 7.21 5.23 9.06l77.79 44.91-26.93 15.55c-.27.18-.61.21-.91.08l-64.42-37.22c-28.63-16.58-38.45-53.21-21.95-81.89zm221.26 51.49-77.79-44.92 26.93-15.54c.27-.18.61-.21.91-.08l64.42 37.19c28.68 16.57 38.51 53.26 21.94 81.94-7.01 12.14-18.05 21.44-31.2 26.28v-75.81c.03-3.74-1.96-7.2-5.2-9.06zm26.8-40.34c-.47-.29-1.3-.79-1.89-1.13l-63.72-36.8c-3.23-1.89-7.23-1.89-10.47 0l-77.79 44.92v-31.1c-.02-.32.13-.63.38-.83l64.41-37.16c28.69-16.55 65.37-6.7 81.91 22 6.99 12.12 9.52 26.31 7.15 40.1zm-168.51 55.43-26.94-15.55c-.29-.14-.48-.42-.52-.74v-74.39c.02-33.12 26.89-59.96 60.01-59.94 14.01 0 27.57 4.92 38.34 13.88-.49.26-1.33.73-1.89 1.07l-63.72 36.8c-3.26 1.85-5.26 5.31-5.24 9.06l-.04 89.79zm14.63-31.54 34.65-20.01 34.65 20v40.01l-34.65 20-34.65-20z' />
      </svg>
    )
  }

  return (
    <svg aria-hidden='true' height='12' viewBox='0 0 24 24' width='12'>
      <path
        d='M12.604 1.34c.393.69.784 1.382 1.174 2.075a.18.18 0 0 0 .157.091h5.552c.174 0 .322.11.446.327l1.454 2.57c.19.337.24.478.024.837-.26.43-.513.864-.76 1.3l-.367.658c-.106.196-.223.28-.04.512l2.652 4.637c.172.301.111.494-.043.77-.437.785-.882 1.564-1.335 2.34-.159.272-.352.375-.68.37-.777-.016-1.552-.01-2.327.016a.099.099 0 0 0-.081.05 575.097 575.097 0 0 1-2.705 4.74c-.169.293-.38.363-.725.364-.997.003-2.002.004-3.017.002a.537.537 0 0 1-.465-.271l-1.335-2.323a.09.09 0 0 0-.083-.049H4.982c-.285.03-.553-.001-.805-.092l-1.603-2.77a.543.543 0 0 1-.002-.54l1.207-2.12a.198.198 0 0 0 0-.197 550.951 550.951 0 0 1-1.875-3.272l-.79-1.395c-.16-.31-.173-.496.095-.965.465-.813.927-1.625 1.387-2.436.132-.234.304-.334.584-.335a338.3 338.3 0 0 1 2.589-.001.124.124 0 0 0 .107-.063l2.806-4.895A.488.488 0 0 1 9.104 1c.524-.001 1.053 0 1.583-.006L11.704 1c.341-.003.724.032.9.34zm-3.432.403a.06.06 0 0 0-.052.03L6.254 6.788a.157.157 0 0 1-.135.078H3.253c-.056 0-.07.025-.041.074l5.81 10.156c.025.042.013.062-.034.063l-2.795.015a.218.218 0 0 0-.2.116l-1.32 2.31c-.044.078-.021.118.068.118l5.716.008c.046 0 .08.02.104.061l1.403 2.454c.046.081.092.082.139 0l5.006-8.76.783-1.382a.055.055 0 0 1 .096 0l1.424 2.53a.122.122 0 0 0 .107.062l2.763-.02a.04.04 0 0 0 .035-.02.041.041 0 0 0 0-.04l-2.9-5.086a.108.108 0 0 1 0-.113l.293-.507 1.12-1.977c.024-.041.012-.062-.035-.062H9.2c-.059 0-.073-.026-.043-.077l1.434-2.505a.107.107 0 0 0 0-.114L9.225 1.774a.06.06 0 0 0-.053-.031zm6.29 8.02c.046 0 .058.02.034.06l-.832 1.465-2.613 4.585a.056.056 0 0 1-.05.029.058.058 0 0 1-.05-.029L8.498 9.841c-.02-.034-.01-.052.028-.054l.216-.012 6.722-.012z'
        fill={`url(#${gradientId})`}
        fillRule='nonzero'
      />
      <defs>
        <linearGradient id={gradientId} x1='0%' x2='100%' y1='0%' y2='0%'>
          <stop offset='0%' stopColor='#6336E7' stopOpacity='.84' />
          <stop offset='100%' stopColor='#6F69F7' stopOpacity='.84' />
        </linearGradient>
      </defs>
    </svg>
  )
}

function getTextWithoutSkills(editor: HTMLElement) {
  const clone = editor.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-skill-pill], [data-skill-separator]').forEach((node) => node.remove())
  return (clone.textContent ?? '').replace(/\u00a0/g, ' ')
}

function getEditorSkills(editor: HTMLElement) {
  const ids = Array.from(editor.querySelectorAll<HTMLElement>('[data-skill-pill]'))
    .map((pill) => pill.dataset.skillPill)
    .filter((id): id is AskAISkillId => Boolean(id && skillIdSet.has(id)))
  return [...new Set(ids)]
}

function getSkillName(id: AskAISkillId) {
  return ASK_AI_SKILLS.find((skill) => skill.id === id)?.name ?? id
}

function buildSkillSeparator() {
  const separator = document.createElement('span')
  separator.dataset.skillSeparator = 'true'
  separator.setAttribute('aria-hidden', 'true')
  separator.setAttribute('contenteditable', 'false')
  separator.textContent = '\u00a0'
  return separator
}

function buildSkillPill(id: AskAISkillId) {
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

async function defaultEnhancePrompt(prompt: string, signal: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    const abort = () => {
      window.clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, 650)
    signal.addEventListener('abort', abort, { once: true })
  })

  return `请基于 PureChatNext 公开文档回答以下问题，并给出清晰的操作步骤和相关文档链接：\n${prompt}`
}

function AIAgentInputInstance({
  maxLength = 1000,
  model,
  onEnhance = defaultEnhancePrompt,
  onModelChange,
  onStop,
  onSubmit,
  pending,
}: Omit<AIAgentInputProps, 'resetKey'>) {
  const editorRef = useRef<HTMLDivElement>(null)
  const plusRef = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const slashRangeRef = useRef<SlashRange | null>(null)
  const enhanceAbortRef = useRef<AbortController | null>(null)
  const originalSnapshotRef = useRef<EditorSnapshot | null>(null)
  const lastValidRef = useRef<LastValidEditor>({ nodes: [], skills: [], text: '' })
  const [value, setValue] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<AskAISkillId[]>([])
  const [enhancePhase, setEnhancePhase] = useState<Phase>('idle')
  const [enhanceError, setEnhanceError] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [modelDescription, setModelDescription] = useState<AskAIModelId | null>(null)
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [slashIndex, setSlashIndex] = useState(0)
  const [slashKeyboard, setSlashKeyboard] = useState(false)

  const slashResults = ASK_AI_SKILLS.filter((skill) =>
    skill.name.toLowerCase().includes(slashQuery.toLowerCase()),
  )
  const enhancing = enhancePhase === 'enhancing'
  const hasText = value.trim().length > 0
  const visuallyEmpty = isEditorVisuallyEmpty(value, selectedSkills)
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

  function markStartingPills(editor: HTMLElement) {
    editor.querySelectorAll<HTMLElement>('[data-skill-pill]').forEach((pill) => {
      let atStart = true
      for (let node = pill.previousSibling; node; node = node.previousSibling) {
        if (node instanceof HTMLElement && node.dataset.skillSeparator) continue
        if (node.nodeType === Node.TEXT_NODE && !(node.textContent ?? '').trim()) continue
        atStart = false
        break
      }
      pill.toggleAttribute('data-start', atStart)
    })
  }

  function captureValidEditor(editor: HTMLElement, text: string, skills: AskAISkillId[]) {
    lastValidRef.current = {
      nodes: Array.from(editor.childNodes, (node) => node.cloneNode(true)),
      skills: [...skills],
      text,
    }
  }

  function syncEditor() {
    const editor = editorRef.current
    if (!editor) return false

    // Browsers may create one text node per typed character in contenteditable.
    // Normalizing keeps caret/token calculations stable without touching skill pills.
    editor.normalize()
    const nextText = getTextWithoutSkills(editor)
    const nextSkills = getEditorSkills(editor)
    if (nextText.length > maxLength) {
      const last = lastValidRef.current
      editor.replaceChildren(...last.nodes.map((node) => node.cloneNode(true)))
      setValue(last.text)
      setSelectedSkills(last.skills)
      requestAnimationFrame(focusEditorEnd)
      return false
    }

    markStartingPills(editor)
    setValue(nextText)
    setSelectedSkills(nextSkills)
    captureValidEditor(editor, nextText, nextSkills)
    return true
  }

  function setEditorState(text: string, skills: AskAISkillId[], focus = true) {
    const editor = editorRef.current
    if (!editor) return

    const nodes: Node[] = []
    skills.forEach((skill) => nodes.push(buildSkillPill(skill), buildSkillSeparator()))
    if (text) nodes.push(document.createTextNode(text))
    editor.replaceChildren(...nodes)
    markStartingPills(editor)
    setValue(text)
    setSelectedSkills(skills)
    captureValidEditor(editor, text, skills)
    if (focus) requestAnimationFrame(focusEditorEnd)
  }

  function closeSlashMenu() {
    slashRangeRef.current = null
    setSlashOpen(false)
    setSlashQuery('')
    setSlashIndex(0)
    setSlashKeyboard(false)
  }

  function closePlusMenu() {
    setMenuOpen(false)
    setSkillsOpen(false)
    setModelDescription(null)
  }

  function resetPrompt() {
    enhanceAbortRef.current?.abort()
    editorRef.current?.replaceChildren()
    savedRangeRef.current = null
    originalSnapshotRef.current = null
    lastValidRef.current = { nodes: [], skills: [], text: '' }
    setValue('')
    setSelectedSkills([])
    setEnhancePhase('idle')
    setEnhanceError(false)
    closeSlashMenu()
    closePlusMenu()
  }

  function detectSlashCommand() {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection?.rangeCount || !selection.isCollapsed) {
      closeSlashMenu()
      return
    }

    const range = selection.getRangeAt(0)
    let node: Node = range.startContainer
    let offset = range.startOffset

    if (node.nodeType === Node.ELEMENT_NODE && offset > 0) {
      node = node.childNodes[offset - 1]
      while (node.nodeType === Node.ELEMENT_NODE && node.lastChild) node = node.lastChild
      if (node.nodeType === Node.TEXT_NODE) offset = node.textContent?.length ?? 0
    }

    if (node.nodeType !== Node.TEXT_NODE || !editor.contains(node)) {
      closeSlashMenu()
      return
    }

    const token = findSlashToken((node.textContent ?? '').slice(0, offset))
    if (!token) {
      closeSlashMenu()
      return
    }

    slashRangeRef.current = { end: token.end, node: node as Text, start: token.start }
    setSlashQuery(token.query)
    setSlashIndex(0)
    setSlashKeyboard(false)
    setSlashOpen(true)
  }

  function saveSelection() {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (editor && selection?.rangeCount && editor.contains(selection.anchorNode)) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange()
    }
  }

  function insertSkill(id: AskAISkillId, replaceSlash = false) {
    const editor = editorRef.current
    if (!editor) return

    const nextSkills = addUniqueSkill(selectedSkills, id)
    if (nextSkills.length === selectedSkills.length) {
      closeSlashMenu()
      closePlusMenu()
      requestAnimationFrame(focusEditorEnd)
      return
    }

    let range: Range | null = null
    const slashRange = slashRangeRef.current
    if (
      replaceSlash &&
      slashRange?.node.isConnected &&
      editor.contains(slashRange.node) &&
      slashRange.end <= (slashRange.node.textContent?.length ?? 0)
    ) {
      range = document.createRange()
      range.setStart(slashRange.node, slashRange.start)
      range.setEnd(slashRange.node, slashRange.end)
    } else {
      const selection = window.getSelection()
      if (selection?.rangeCount && editor.contains(selection.anchorNode)) {
        range = selection.getRangeAt(0).cloneRange()
      } else if (savedRangeRef.current && editor.contains(savedRangeRef.current.startContainer)) {
        range = savedRangeRef.current.cloneRange()
      }
    }

    if (!range) {
      range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
    }

    range.deleteContents()
    const pill = buildSkillPill(id)
    const separator = buildSkillSeparator()
    range.insertNode(pill)
    pill.after(separator)

    const after = document.createRange()
    after.setStartAfter(separator)
    after.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(after)
    savedRangeRef.current = after.cloneRange()
    syncEditor()
    closeSlashMenu()
    closePlusMenu()
    editor.focus()
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
    if (separator instanceof HTMLElement && separator.dataset.skillSeparator) separator.remove()
    syncEditor()
    focusEditorEnd()
  }

  function insertPlainText(text: string) {
    const editor = editorRef.current
    if (!editor || !text) return

    const selection = window.getSelection()
    let range: Range | null = null
    if (selection?.rangeCount && editor.contains(selection.anchorNode)) range = selection.getRangeAt(0).cloneRange()
    if (!range) {
      range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
    }

    range.deleteContents()
    const textNode = document.createTextNode(text)
    range.insertNode(textNode)
    const after = document.createRange()
    after.setStartAfter(textNode)
    after.collapse(true)
    selection?.removeAllRanges()
    selection?.addRange(after)
    savedRangeRef.current = after.cloneRange()
    syncEditor()
  }

  function insertExternalText(text: string) {
    const editor = editorRef.current
    if (!editor) return
    const currentLength = getTextWithoutSkills(editor).length
    insertPlainText(clipInsertedText(currentLength, text.replace(/\r\n?/g, '\n'), maxLength))
  }

  function handlePaste(event: ReactClipboardEvent<HTMLDivElement>) {
    event.preventDefault()
    insertExternalText(event.clipboardData.getData('text/plain'))
  }

  function handleDrop(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault()
    insertExternalText(event.dataTransfer.getData('text/plain'))
  }

  function submit() {
    if (!sendActive) return
    onSubmit({ skills: [...selectedSkills], text: value.trim() })
    resetPrompt()
  }

  async function enhancePrompt() {
    if (!hasText || enhancing || pending) return

    closePlusMenu()
    const snapshot = { skills: [...selectedSkills], text: value }
    originalSnapshotRef.current = snapshot
    enhanceAbortRef.current?.abort()
    const controller = new AbortController()
    enhanceAbortRef.current = controller
    setEnhanceError(false)
    setEnhancePhase('enhancing')

    try {
      const enhanced = await onEnhance(value.trim(), controller.signal)
      if (controller.signal.aborted) return
      setEditorState(enhanced.slice(0, maxLength), snapshot.skills)
      setEnhancePhase('enhanced')
    } catch {
      if (controller.signal.aborted) return
      setEditorState(snapshot.text, snapshot.skills)
      setEnhanceError(true)
      setEnhancePhase('idle')
    }
  }

  function revertPrompt() {
    enhanceAbortRef.current?.abort()
    const snapshot = originalSnapshotRef.current
    if (!snapshot) return
    setEditorState(snapshot.text, snapshot.skills)
    setEnhancePhase('idle')
    setEnhanceError(false)
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return

    if (slashOpen && slashResults.length) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        setSlashKeyboard(true)
        setSlashIndex(
          (index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + slashResults.length) % slashResults.length,
        )
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        insertSkill(slashResults[slashIndex]?.id ?? slashResults[0].id, true)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        closeSlashMenu()
        return
      }
    }

    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault()
      insertPlainText('\n')
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      submit()
    }
  }

  useEffect(() => {
    if (!menuOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (!plusRef.current?.contains(event.target as Node)) closePlusMenu()
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') closePlusMenu()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menuOpen])

  useEffect(() => () => enhanceAbortRef.current?.abort(), [])

  return (
    <div className={styles.wrap}>
      <div className={styles.frame} data-enhancing={enhancing || undefined}>
        <div className={styles.editorWrap}>
          {enhancing ? (
            <div aria-live='polite' className={styles.enhancingText}>
              {value}
            </div>
          ) : (
            <div
              aria-disabled={pending}
              aria-label='向文档助手提问'
              aria-multiline='true'
              className={styles.field}
              contentEditable={!pending}
              data-empty={visuallyEmpty || undefined}
              data-placeholder='向文档助手提问'
              onBlur={saveSelection}
              onClick={removeSkill}
              onDrop={handleDrop}
              onInput={() => {
                if (!syncEditor()) return
                if (enhancePhase === 'enhanced') setEnhancePhase('idle')
                setEnhanceError(false)
                detectSlashCommand()
              }}
              onKeyDown={handleKeyDown}
              onKeyUp={saveSelection}
              onMouseUp={saveSelection}
              onPaste={handlePaste}
              ref={editorRef}
              role='textbox'
              suppressContentEditableWarning
            />
          )}

          {slashOpen && !enhancing && !pending ? (
            <div
              aria-label='Skills'
              className={styles.slashMenu}
              data-keyboard={slashKeyboard || undefined}
              onMouseMove={() => setSlashKeyboard(false)}
              role='listbox'
            >
              <div className={styles.menuLabel}>Skills</div>
              {slashResults.length ? (
                slashResults.map((skill, index) => (
                  <button
                    aria-selected={index === slashIndex}
                    className={`${styles.menuItem} ${index === slashIndex ? styles.menuItemActive : ''}`}
                    key={skill.id}
                    onClick={() => insertSkill(skill.id, true)}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => {
                      if (!slashKeyboard) setSlashIndex(index)
                    }}
                    role='option'
                    title={skill.description}
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
              aria-haspopup='menu'
              aria-label='选择 Skills 或模型'
              className={`${styles.iconBtn} ${styles.plus}`}
              data-open={menuOpen || undefined}
              disabled={pending || enhancing}
              onClick={() => {
                if (menuOpen) closePlusMenu()
                else setMenuOpen(true)
              }}
              type='button'
            >
              <span className={styles.plusIcon}>
                <Plus aria-hidden className='size-3.5' />
              </span>
            </button>

            {menuOpen ? (
              <div aria-label='AI Agent Input options' className={styles.menu} role='menu'>
                <div
                  className={styles.menuSub}
                  onMouseEnter={() => setSkillsOpen(true)}
                  onMouseLeave={() => setSkillsOpen(false)}
                >
                  <button
                    aria-expanded={skillsOpen}
                    aria-haspopup='menu'
                    className={styles.menuItem}
                    onClick={() => setSkillsOpen(true)}
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
                    <div aria-label='Document answer skills' className={styles.menuFlyout} role='menu'>
                      {ASK_AI_SKILLS.map((skill) => (
                        <button
                          className={styles.menuItem}
                          disabled={selectedSkills.includes(skill.id)}
                          key={skill.id}
                          onClick={() => insertSkill(skill.id)}
                          role='menuitem'
                          title={skill.description}
                          type='button'
                        >
                          <span className={styles.menuName}>{skill.name}</span>
                          {selectedSkills.includes(skill.id) ? (
                            <Check aria-hidden className={`${styles.menuCheck} size-3.5`} />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className={styles.menuDivider} />
                <div className={styles.menuLabel}>Model</div>
                {ASK_AI_MODELS.map((item) => (
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
                        onModelChange(item.id)
                        closePlusMenu()
                      }}
                      role='menuitemradio'
                      type='button'
                    >
                      <span className={styles.menuBrand}>
                        <ModelIcon brand={item.brand} />
                      </span>
                      <span className={styles.menuName}>{item.name}</span>
                      {model === item.id ? <Check aria-hidden className={`${styles.menuCheck} size-3.5`} /> : null}
                    </button>
                    {modelDescription === item.id ? (
                      <div className={styles.menuPopover} role='tooltip'>
                        <div className={styles.popoverTitle}>{item.name}</div>
                        <p className={styles.popoverDesc}>{item.description}</p>
                        <div className={styles.popoverMeta}>{item.context}</div>
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
            ) : hasText && !pending ? (
              <button
                className={styles.pill}
                onClick={enhancePhase === 'enhanced' ? revertPrompt : () => void enhancePrompt()}
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
      {enhanceError ? <p className={styles.enhanceError}>提示词增强失败，已恢复原内容。</p> : null}
    </div>
  )
}

export function AIAgentInput({ resetKey, ...props }: AIAgentInputProps) {
  return <AIAgentInputInstance key={resetKey} {...props} />
}
