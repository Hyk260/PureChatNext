'use client'

import { useState } from 'react'
import { Code2 } from 'lucide-react'

import { CodeBlock } from '@pure/ui'
import type { CodeBlockVariant } from '@pure/ui'

const VARIANTS: Array<{ description: string; label: string; value: CodeBlockVariant }> = [
  { description: '行号、语法高亮、复制按钮', label: 'Code', value: 'Code' },
  { description: '统一 diff、红绿行、词级高亮', label: 'Diff', value: 'Diff' },
]

export default function CodeBlockPage() {
  const [variant, setVariant] = useState<CodeBlockVariant>('Code')

  return (
    <main className='h-screen overflow-y-auto bg-[#f5f7fb] text-slate-950'>
      <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8'>
        <header className='flex flex-col gap-2'>
          <div className='flex items-center gap-3'>
            <span className='flex size-10 items-center justify-center rounded-xl bg-white shadow-sm'>
              <Code2 className='size-5 text-slate-700' />
            </span>
            <div>
              <h1 className='text-2xl font-semibold'>CodeBlock</h1>
              <p className='text-sm text-slate-500'>验证 `@pure/ui` 代码块与 Diff 两种展示效果。</p>
            </div>
          </div>
        </header>

        <section className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
          <h2 className='text-sm font-medium text-slate-700'>当前变体</h2>
          <div className='mt-3 flex flex-wrap gap-2'>
            {VARIANTS.map((item) => {
              const active = variant === item.value
              return (
                <button
                  key={item.value}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  onClick={() => setVariant(item.value)}
                  type='button'
                >
                  {item.label}
                </button>
              )
            })}
          </div>
          <p className='mt-2 text-xs text-slate-500'>{VARIANTS.find((item) => item.value === variant)?.description}</p>

          <div className='mt-5'>
            <CodeBlock variant={variant} />
          </div>
        </section>

        <section className='grid gap-6 lg:grid-cols-2'>
          {VARIANTS.map((item) => (
            <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm' key={item.value}>
              <h2 className='text-sm font-medium text-slate-700'>{item.label}</h2>
              <p className='mt-1 text-xs text-slate-500'>{item.description}</p>
              <div className='mt-4'>
                <CodeBlock variant={item.value} />
              </div>
            </div>
          ))}
        </section>

        <section className='rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm'>
          <h2 className='font-medium text-slate-800'>对照清单</h2>
          <ul className='mt-3 list-disc space-y-1 pl-5'>
            <li>Code：行号、关键字/字符串着色、Copy 后变成 Copied</li>
            <li>Diff：右上角 +1 / -1，删除行红底斜线条，新增行绿底，温度字符串有词级高亮</li>
            <li>长行应换行，而不是横向撑破卡片</li>
          </ul>
        </section>
      </div>
    </main>
  )
}
