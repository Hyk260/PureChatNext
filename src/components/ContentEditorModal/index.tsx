'use client'

import { Modal } from '@pure/ui'
import { lazy, Suspense } from 'react'

import type { ContentEditorModalProps } from './EditorModal'

const EditorModal = lazy(() => import('./EditorModal'))

export default function ContentEditorModal(props: ContentEditorModalProps) {
  if (!props.open) return null

  return (
    <Suspense
      fallback={
        <Modal loading open title='编辑内容' width='min(90vw, 920px)' footer={null} onCancel={props.onCancel} />
      }
    >
      <EditorModal key={props.value} {...props} />
    </Suspense>
  )
}
