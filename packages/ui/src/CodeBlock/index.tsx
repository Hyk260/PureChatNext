'use client'

import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'

/* ─────────────────────────────────────────────────────────
 * CODE BLOCK
 * 轻量编辑器面板，卡片内可切换两种展示：
 *   · Code — 带行号的代码列表
 *   · Diff — 统一 diff：新旧行号槽、绿/红强调条与行底色，
 *     以及单词级增删高亮。
 * 两者共用语法着色、内边距与换行行为。
 * ───────────────────────────────────────────────────────── */

const FILE = 'churn.ts'

const CODE_LINES = [
  'export async function churnBatch() {',
  '  const flavor = await getFlavor("pistachio");',
  '  const base = await dairy.fetch({ flavor });',
  '  await freezer.store(base, { temp: "-16C" });',
  '  if (!base.approved) return null;',
  '  return base.gallons;',
  '}',
]
const RAW = CODE_LINES.join('\n')

type Piece = { text: string; change?: 'add' | 'del' }
type Row = { old: number | null; cur: number | null; type: 'ctx' | 'add' | 'del'; pieces: Piece[] }

const DIFF: Row[] = [
  { old: 1, cur: 1, type: 'ctx', pieces: [{ text: 'export async function churnBatch() {' }] },
  { old: 2, cur: 2, type: 'ctx', pieces: [{ text: '  const flavor = await getFlavor("pistachio");' }] },
  { old: 3, cur: 3, type: 'ctx', pieces: [{ text: '  const base = await dairy.fetch({ flavor });' }] },
  {
    old: 4,
    cur: null,
    type: 'del',
    pieces: [{ text: '  await freezer.store(base, { temp: ' }, { text: '"-14C"', change: 'del' }, { text: ' });' }],
  },
  {
    old: null,
    cur: 4,
    type: 'add',
    pieces: [{ text: '  await freezer.store(base, { temp: ' }, { text: '"-16C"', change: 'add' }, { text: ' });' }],
  },
  { old: null, cur: 5, type: 'add', pieces: [{ text: '  if (!base.approved) return null;' }] },
  { old: 5, cur: 6, type: 'ctx', pieces: [{ text: '  return base.gallons;' }] },
  { old: 6, cur: 7, type: 'ctx', pieces: [{ text: '}' }] },
]

const HATCH = 'repeating-linear-gradient(45deg, var(--red) 0, var(--red) 1.5px, transparent 1.5px, transparent 3px)'

/* light syntax coloring — keywords/imports/conditionals, functions, strings & numbers */
const KEYWORDS = new Set([
  'import',
  'from',
  'export',
  'default',
  'async',
  'function',
  'const',
  'let',
  'var',
  'await',
  'return',
  'if',
  'else',
  'for',
  'while',
  'new',
  'throw',
  'try',
  'catch',
  'null',
  'true',
  'false',
  'undefined',
])
const TOKEN =
  /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`[^`]*`|\b\d+(?:\.\d+)?\b|\b(?:import|from|export|default|async|function|const|let|var|await|return|if|else|for|while|new|throw|try|catch|null|true|false|undefined)\b|[A-Za-z_$][\w$]*(?=\s*\())/g

function highlight(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let k = 0
  for (const m of text.matchAll(TOKEN)) {
    const idx = m.index ?? 0
    const t = m[0]
    if (idx > last) nodes.push(<span key={k++}>{text.slice(last, idx)}</span>)
    let color: string
    let weight: number | undefined
    if (/^["'`]/.test(t) || /^\d/.test(t))
      color = 'var(--orange)' // string / number
    else if (KEYWORDS.has(t))
      color = 'var(--accent-ink)' // keyword / import / conditional
    else {
      color = 'var(--ink)'
      weight = 500
    } // function call
    nodes.push(
      <span key={k++} style={{ color, fontWeight: weight }}>
        {t}
      </span>
    )
    last = idx + t.length
  }
  if (last < text.length) nodes.push(<span key={k++}>{text.slice(last)}</span>)
  return nodes
}

function Pieces({ pieces }: { pieces: Piece[] }) {
  return (
    <>
      {pieces.map((p, i) => {
        if (p.change) {
          const add = p.change === 'add'
          return (
            <span
              key={i}
              className='rounded-[3px]'
              style={{
                background: `color-mix(in srgb, var(--${add ? 'green' : 'red'}) 18%, transparent)`,
                padding: '0 2px',
                margin: '0 -1px',
                boxDecorationBreak: 'clone',
                WebkitBoxDecorationBreak: 'clone',
              }}
            >
              {highlight(p.text)}
            </span>
          )
        }
        return <span key={i}>{highlight(p.text)}</span>
      })}
    </>
  )
}

function FileIcon() {
  return (
    <svg
      aria-hidden
      width='15'
      height='15'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.8'
      strokeLinecap='round'
      strokeLinejoin='round'
      className='shrink-0 text-ink-3'
    >
      <path d='M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5' />
    </svg>
  )
}

export type CodeBlockVariant = 'Code' | 'Diff'

export default function CodeBlock({ variant = 'Code' }: { variant?: CodeBlockVariant }) {
  const [copied, setCopied] = useState(false)
  const isDiff = variant === 'Diff'

  const copy = useCallback(() => {
    navigator.clipboard.writeText(RAW).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [])

  const added = DIFF.filter((r) => r.type === 'add').length
  const removed = DIFF.filter((r) => r.type === 'del').length

  return (
    <div className='w-full max-w-105 overflow-hidden rounded-card bg-surface shadow-card'>
      {/* header — file · (diff stat | copy) */}
      <div className='flex h-11 items-center gap-2 border-b border-line px-4 text-[12.5px]'>
        <span className='inline-flex min-w-0 items-center gap-[7px]'>
          <FileIcon />
          <span className='truncate font-mono leading-none text-ink'>{FILE}</span>
        </span>

        {isDiff ? (
          <span className='ml-auto inline-flex items-center gap-2 font-mono text-[12px] leading-none tabular-nums'>
            <span className='text-green'>+{added}</span>
            <span className='text-red'>-{removed}</span>
          </span>
        ) : (
          <button
            type='button'
            aria-label='Copy code'
            onClick={copy}
            className={`-mr-1 ml-auto flex h-6 items-center gap-1 rounded-[6px] px-1.5 text-[12px]
              font-medium transition-colors duration-100 hover:bg-hover
              ${copied ? 'text-green' : 'text-ink-3 hover:text-ink'}`}
          >
            {copied ? (
              <svg
                width='11'
                height='11'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='3'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <path d='M20 6L9 17l-5-5' />
              </svg>
            ) : (
              <svg
                width='11'
                height='11'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <rect x='9' y='9' width='12' height='12' rx='2.5' />
                <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
              </svg>
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>

      {/* body — equal 12px inset on top / left / right; lines wrap */}
      <div className='py-3 font-mono text-[12.5px] leading-[1.65] text-ink-2'>
        {isDiff ? (
          <div className='relative'>
            <span className='pointer-events-none absolute inset-y-0 left-5 w-px bg-line' />
            {DIFF.map((r, i) => {
              const add = r.type === 'add'
              const del = r.type === 'del'
              // one gutter column: removals keep the old number, additions/context show the new one
              const num = del ? r.old : r.cur
              return (
                <div
                  key={i}
                  className={`relative grid grid-cols-[20px_minmax(0,1fr)] items-start
                    ${add ? 'bg-green-tint' : del ? 'bg-red-tint' : ''}`}
                >
                  {(add || del) && (
                    <span
                      className='absolute inset-y-0 left-0 w-[3px]'
                      style={{ background: add ? 'var(--green)' : HATCH }}
                    />
                  )}
                  <span
                    className={`select-none text-center text-[11px] ${add ? 'text-green' : del ? 'text-red' : 'text-ink-3'}`}
                  >
                    {num ?? ''}
                  </span>
                  <code className='pr-3 pl-1 break-words whitespace-pre-wrap'>
                    <Pieces pieces={r.pieces} />
                  </code>
                </div>
              )
            })}
          </div>
        ) : (
          <div className='relative'>
            <span className='pointer-events-none absolute inset-y-0 left-5 w-px bg-line' />
            {CODE_LINES.map((line, i) => (
              <div key={i} className='grid grid-cols-[20px_minmax(0,1fr)] items-start'>
                <span className='select-none text-center text-[11px] text-ink-3'>{i + 1}</span>
                <code className='pr-3 pl-1 wrap-break-word whitespace-pre-wrap'>{highlight(line)}</code>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
