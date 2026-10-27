'use client'

import { useState } from 'react'
import { Layers3 } from 'lucide-react'

import { ContextWindow } from '@/components/ContextWindow'
import type { ContextWindowPart } from '@/components/ContextWindow'

const DEMO_LIMIT = 200_000
const DEMO_MODEL = 'claude-sonnet-5-5'

const DEMO_PARTS: ContextWindowPart[] = [
  { id: 'system', label: 'System prompt', tokens: 4_200, locked: true },
  { id: 'tools', label: 'Tools', tokens: 12_800 },
  {
    id: 'files',
    label: 'Files',
    items: [
      { id: 'schema', label: 'schema.prisma', tokens: 9_400 },
      { id: 'billing', label: 'billing.ts', tokens: 21_300 },
      { id: 'meeting-notes', label: 'meeting-notes.md', tokens: 6_000 },
    ],
  },
  { id: 'chat', label: 'Conversation', tokens: 30_400, compact: true },
  { id: 'memory', label: 'Memory', tokens: 3_900 },
]

const updatePart = (
  parts: ContextWindowPart[],
  partId: string,
  update: (part: ContextWindowPart) => ContextWindowPart
) => parts.map((part) => (part.id === partId ? update(part) : part))

export default function ContextWindowPage() {
  const [parts, setParts] = useState<ContextWindowPart[]>(DEMO_PARTS)
  const [feedback, setFeedback] = useState('可悬停分类或文件查看网格高亮，也可以试试移除和压缩。')

  const handleRemoveItem = (partId: string, itemId: string) => {
    const removedItem = parts.find((part) => part.id === partId)?.items?.find((item) => item.id === itemId)
    setParts((current) =>
      updatePart(current, partId, (part) => ({ ...part, items: part.items?.filter((item) => item.id !== itemId) }))
    )
    if (removedItem) setFeedback(`已移除 ${removedItem.label}`)
  }

  const handleCompact = (partId: string) => {
    setParts((current) =>
      updatePart(current, partId, (part) => ({ ...part, tokens: Math.round((part.tokens ?? 0) * 0.35) }))
    )
    setFeedback('对话已压缩，容量格同步更新。')
  }

  const handleNewChat = () => {
    setParts(DEMO_PARTS)
    setFeedback('新对话已开始，样例上下文已重置。')
  }

  return (
    <main className='h-full min-h-0 overflow-y-auto bg-background text-foreground'>
      <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-8 sm:px-8'>
        <header className='flex items-center gap-3'>
          <span className='flex-center size-10 shrink-0 rounded-xl bg-card shadow-sm'>
            <Layers3 aria-hidden='true' className='size-5 text-primary' />
          </span>
          <div>
            <h1 className='text-2xl font-semibold'>Context Window</h1>
            <p className='text-sm text-muted-foreground'>上下文用量、文件移除与对话压缩预览。</p>
          </div>
        </header>

        <section className='rounded-2xl border border-border bg-card p-5 shadow-sm'>
          <h2 className='text-sm font-medium'>交互预览</h2>
          <p aria-live='polite' className='mt-1 text-xs text-muted-foreground'>
            {feedback}
          </p>
          <div className='mt-5 flex justify-center rounded-xl bg-muted/40 p-4 sm:p-8'>
            <ContextWindow
              limit={DEMO_LIMIT}
              model={DEMO_MODEL}
              onCompact={handleCompact}
              onNewChat={handleNewChat}
              onRemoveItem={handleRemoveItem}
              parts={parts}
            />
          </div>
        </section>
      </div>
    </main>
  )
}
