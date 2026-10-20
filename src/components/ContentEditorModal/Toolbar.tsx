'use client'

import type { IEditor } from '@lobehub/editor'
import { ChatInputActions, useEditorState } from '@lobehub/editor/react'
import type { ChatInputActionsProps } from '@lobehub/editor/react'
import { Flex } from '@pure/ui'
import {
  Bold,
  CodeXml,
  Italic,
  List,
  ListOrdered,
  ListTodo,
  MessageSquareQuote,
  Sigma,
  SquareDashedBottomCode,
  Strikethrough,
  Underline,
} from 'lucide-react'
import { cloneElement, isValidElement } from 'react'
import type { ReactNode } from 'react'

const labelAction = (action: ReactNode, label: ReactNode) => {
  if (!isValidElement<{ 'aria-label'?: string }>(action) || typeof label !== 'string') return action
  return cloneElement(action, { 'aria-label': label })
}

const getToolbarItems = (state: ReturnType<typeof useEditorState>): ChatInputActionsProps['items'] => [
  { active: state.isBold, icon: Bold, key: 'bold', label: '加粗', onClick: state.bold },
  { active: state.isItalic, icon: Italic, key: 'italic', label: '斜体', onClick: state.italic },
  { active: state.isUnderline, icon: Underline, key: 'underline', label: '下划线', onClick: state.underline },
  {
    active: state.isStrikethrough,
    icon: Strikethrough,
    key: 'strikethrough',
    label: '删除线',
    onClick: state.strikethrough,
  },
  { type: 'divider' },
  { icon: List, key: 'bulletList', label: '无序列表', onClick: state.bulletList },
  { icon: ListOrdered, key: 'numberList', label: '有序列表', onClick: state.numberList },
  { icon: ListTodo, key: 'checkList', label: '任务列表', onClick: state.checkList },
  { type: 'divider' },
  {
    active: state.isBlockquote,
    icon: MessageSquareQuote,
    key: 'blockquote',
    label: '引用',
    onClick: state.blockquote,
  },
  { type: 'divider' },
  { icon: Sigma, key: 'math', label: '公式', onClick: state.insertMath },
  { active: state.isCode, icon: CodeXml, key: 'code', label: '行内代码', onClick: state.code },
  {
    active: state.isCodeblock,
    icon: SquareDashedBottomCode,
    key: 'codeblock',
    label: '代码块',
    onClick: state.codeblock,
  },
]

export default function Toolbar({ editor }: { editor: IEditor }) {
  const state = useEditorState(editor)
  const items = getToolbarItems(state)?.map((item) => {
    if (!('label' in item)) return item
    return { ...item, wrapper: (action: ReactNode) => labelAction(action, item.label) }
  })

  return (
    <Flex
      role='toolbar'
      aria-label='内容格式'
      className='shrink-0 overflow-x-auto border-b border-app-border-secondary bg-app-layout p-1.5'
    >
      <ChatInputActions autoCollapse={false} items={items} />
    </Flex>
  )
}
