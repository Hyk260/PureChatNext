'use client'

import {
  ReactCodePlugin,
  ReactCodemirrorPlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactMathPlugin,
  ReactTablePlugin,
} from '@lobehub/editor'
import { Editor, useEditor } from '@lobehub/editor/react'
import { Flex, Modal, Text } from '@pure/ui'
import { useRef, useState } from 'react'

import Toolbar from './Toolbar'

const EDITOR_PLUGINS = [
  ReactListPlugin,
  ReactCodePlugin,
  ReactCodemirrorPlugin,
  ReactHRPlugin,
  ReactLinkPlugin,
  ReactMathPlugin,
  ReactTablePlugin,
  ReactImagePlugin,
]

export interface ContentEditorModalProps {
  onCancel: () => void
  onSubmit: (value: string) => void | Promise<void>
  open: boolean
  value: string
}

export default function EditorModal({ onCancel, onSubmit, open, value }: ContentEditorModalProps) {
  const editor = useEditor()
  const initialMarkdown = useRef<string | null>(null)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const handleSubmit = async () => {
    if (!ready || saving) return

    const next = String(editor.getDocument('markdown') ?? '').trim()
    if (!next || next === initialMarkdown.current) {
      onCancel()
      return
    }

    setSaveError(false)
    setSaving(true)
    try {
      await onSubmit(next)
      onCancel()
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      cancelText='取消'
      closable={false}
      confirmLoading={saving}
      draggable={false}
      okButtonProps={{ disabled: !ready }}
      okText='保存'
      open={open}
      title='编辑内容'
      width='min(90vw, 920px)'
      classNames={{ header: 'sr-only' }}
      styles={{ body: { padding: 0, overflow: 'hidden' } }}
      onCancel={onCancel}
      onOk={handleSubmit}
    >
      <Flex className='min-h-0 flex-col' aria-label='编辑内容'>
        <Toolbar editor={editor} />
        <div className='max-h-[calc(90dvh-120px)] min-h-[50dvh] overflow-auto p-4 sm:p-6'>
          <Editor
            autoFocus
            className='min-h-full pb-24 [--lobe-block-anchor-padding:16px] sm:[--lobe-block-anchor-padding:24px]'
            content={value}
            editable={!saving}
            editor={editor}
            plugins={EDITOR_PLUGINS}
            type='markdown'
            variant='chat'
            onInit={(instance) => {
              const root = instance.getRootElement()
              root?.setAttribute('role', 'textbox')
              root?.setAttribute('aria-label', '消息内容')
              root?.setAttribute('aria-multiline', 'true')
              initialMarkdown.current = String(editor.getDocument('markdown') ?? '').trim()
              setReady(true)
            }}
          />
        </div>
        {saveError ? (
          <Text role='alert' type='danger' className='px-4 pb-3'>
            保存失败，请重试
          </Text>
        ) : null}
      </Flex>
    </Modal>
  )
}
