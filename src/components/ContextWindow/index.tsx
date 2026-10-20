'use client'

import { createStaticStyles, cssVar, keyframes } from '@lobehub/ui'
import clsx from 'clsx'
import { ArrowRight, LockKeyhole, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FocusEvent } from 'react'

import { formatContextTokens, getContextWindowModel, getContextWindowPartTokens } from './contextWindowModel'
import type { ContextWindowItem, ContextWindowPart } from './contextWindowModel'

const GRID_CELL_COUNT = 200
const GRID_COLUMNS = 40
const COMPACTION_ANIMATION_MS = 720
const PART_COLOR_CLASSES = [
  'bg-foreground',
  'bg-muted-foreground',
  'bg-muted-foreground/60',
  'bg-primary',
  'bg-primary/60',
  'bg-primary/35',
] as const

const compactCells = keyframes`
  0% {
    opacity: 1;
    transform: scale(1);
    filter: brightness(1);
  }
  35% {
    opacity: 1;
    transform: scale(1.08);
    filter: brightness(1.65);
  }
  100% {
    opacity: 0.28;
    transform: scale(0.72);
    filter: brightness(1);
  }
`

// 保留 createStaticStyles：容量格压缩动画包含 keyframes 和减少动态效果适配。
const styles = createStaticStyles(({ css }) => ({
  cell: css`
    aspect-ratio: 0.82;
    border-radius: 2px;
    transition:
      background-color 180ms ease,
      opacity 180ms ease,
      transform 180ms ease;
  `,
  compacting: css`
    animation: ${compactCells} ${COMPACTION_ANIMATION_MS}ms ease-out both;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
      transition: none;
    }
  `,
  compactButton: css`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    color: ${cssVar.colorTextSecondary};
    transition:
      background-color 180ms ease,
      color 180ms ease;

    &:hover:not(:disabled) {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
    }

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: 1px;
    }

    &:disabled {
      cursor: wait;
    }
  `,
  removeButton: css`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    color: ${cssVar.colorTextSecondary};
    transition:
      background-color 180ms ease,
      color 180ms ease;

    &:hover:not(:disabled) {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
    }

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: 1px;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }
  `,
  newChatButton: css`
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 28px;
    padding: 0 6px;
    border-radius: 6px;
    color: ${cssVar.colorText};
    font-weight: 500;
    transition: background-color 180ms ease;

    &:hover:not(:disabled) {
      background: ${cssVar.colorFillSecondary};
    }

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: 1px;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }
  `,
}))

interface HoverTarget {
  partId: string
  itemId?: string
}

export interface ContextWindowProps {
  limit: number
  model: string
  parts: ContextWindowPart[]
  onRemoveItem?: (partId: string, itemId: string) => void
  onCompact?: (partId: string) => void
  onNewChat?: () => void
}

const getCellColorClass = (colorIndex: number | undefined): string => {
  if (colorIndex === undefined) return 'bg-border'
  return PART_COLOR_CLASSES[colorIndex % PART_COLOR_CLASSES.length]
}

const isTargetHighlighted = (target: HoverTarget | null, partId: string, itemId?: string): boolean => {
  if (!target) return true
  if (target.partId !== partId) return false
  return target.itemId === undefined || target.itemId === itemId
}

const getPartLabel = (part: ContextWindowPart): string =>
  `${part.label}, ${formatContextTokens(getContextWindowPartTokens(part), true)} tokens`

interface PartRowProps {
  part: ContextWindowPart
  colorIndex: number
  isCompacting: boolean
  onCompact?: (partId: string) => void
  onRemoveItem?: (partId: string, itemId: string) => void
  onHover: (target: HoverTarget | null) => void
}

const PartRow = ({ part, colorIndex, isCompacting, onCompact, onRemoveItem, onHover }: PartRowProps) => {
  const partTokens = getContextWindowPartTokens(part)
  const isLocked = Boolean(part.locked)
  const canCompact = Boolean(part.compact && onCompact)

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget
    const focusRemainsInPart = nextTarget instanceof Node && event.currentTarget.contains(nextTarget)
    if (!focusRemainsInPart) onHover(null)
  }

  const handleCompact = () => {
    if (onCompact) onCompact(part.id)
  }

  const handleItemHover = (item: ContextWindowItem) => onHover({ itemId: item.id, partId: part.id })

  return (
    <div
      aria-label={getPartLabel(part)}
      className='group'
      onBlurCapture={handleBlur}
      onFocusCapture={() => onHover({ partId: part.id })}
      onMouseEnter={() => onHover({ partId: part.id })}
      onMouseLeave={() => onHover(null)}
      role='group'
    >
      <div className='flex min-h-7 items-center gap-2'>
        <span
          aria-hidden='true'
          className={`size-2 shrink-0 rounded-[2px] ${PART_COLOR_CLASSES[colorIndex % PART_COLOR_CLASSES.length]}`}
        />
        <span className='min-w-0 flex-1 truncate text-[13px] leading-5'>{part.label}</span>
        {isLocked && <LockKeyhole aria-label='Locked' className='size-3.5 shrink-0 text-muted-foreground' />}
        {canCompact && (
          <button
            aria-label={`Compact ${part.label}`}
            className={styles.compactButton}
            disabled={isCompacting}
            onClick={handleCompact}
            title={`Compact ${part.label}`}
            type='button'
          >
            <Sparkles aria-hidden='true' className='size-3.5' />
          </button>
        )}
        <span className='min-w-12 text-right text-[13px] tabular-nums'>{formatContextTokens(partTokens, true)}</span>
      </div>

      {part.items && part.items.length > 0 && (
        <div className='ml-4 mt-0.5 space-y-0.5'>
          {part.items.map((item) => (
            <div
              aria-label={`${item.label}, ${formatContextTokens(item.tokens, true)} tokens`}
              className='flex min-h-7 items-center gap-2 rounded-md pl-0.5 text-muted-foreground'
              key={item.id}
              onFocusCapture={() => handleItemHover(item)}
              onMouseEnter={() => handleItemHover(item)}
              onMouseLeave={() => onHover({ partId: part.id })}
              role='group'
            >
              <span className='min-w-0 flex-1 truncate font-mono text-[11px]'>{item.label}</span>
              <span className='min-w-10 text-right text-[12px] tabular-nums'>
                {formatContextTokens(item.tokens, true)}
              </span>
              <button
                aria-label={`Remove ${item.label}`}
                className={styles.removeButton}
                disabled={isLocked || !onRemoveItem}
                onClick={() => onRemoveItem?.(part.id, item.id)}
                title={isLocked ? 'This item is locked' : `Remove ${item.label}`}
                type='button'
              >
                <X aria-hidden='true' className='size-3.5' />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const ContextWindow = ({ limit, model, onCompact, onNewChat, onRemoveItem, parts }: ContextWindowProps) => {
  const [hoverTarget, setHoverTarget] = useState<HoverTarget | null>(null)
  const [compactingPartId, setCompactingPartId] = useState<string | null>(null)
  const compactTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const view = useMemo(() => getContextWindowModel(parts, limit, GRID_CELL_COUNT), [limit, parts])

  useEffect(
    () => () => {
      if (compactTimerRef.current) clearTimeout(compactTimerRef.current)
    },
    []
  )

  const handleCompact = (partId: string) => {
    if (!onCompact) return
    setCompactingPartId(partId)
    onCompact(partId)
    if (compactTimerRef.current) clearTimeout(compactTimerRef.current)
    compactTimerRef.current = setTimeout(() => setCompactingPartId(null), COMPACTION_ANIMATION_MS)
  }

  const handleGridBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget
    if (!(nextTarget instanceof Node && event.currentTarget.contains(nextTarget))) setHoverTarget(null)
  }

  const modelLabel = model || 'Unknown model'
  const gridLabel = `${formatContextTokens(view.totalTokens)} of ${formatContextTokens(limit)} tokens used`

  return (
    <section
      aria-label='Context window'
      className='w-full max-w-[380px] rounded-2xl border border-border bg-card p-4 text-foreground shadow-card'
    >
      <header className='flex items-center justify-between gap-3'>
        <h2 className='min-w-0 truncate text-[13px] font-medium leading-5'>Context window</h2>
        <span className='flex max-w-[58%] items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-[11px] text-muted-foreground'>
          <Sparkles aria-hidden='true' className='size-3 shrink-0 text-primary' />
          <span className='truncate'>{modelLabel}</span>
        </span>
      </header>

      <div className='mt-1 flex items-end justify-between gap-3'>
        <p className='min-w-0 truncate text-[12px] leading-5 text-muted-foreground'>
          <strong className='mr-1 text-[22px] font-semibold leading-7 tracking-tight text-foreground'>
            {formatContextTokens(view.totalTokens, true)}
          </strong>
          of {formatContextTokens(limit)} tokens
        </p>
        <span className='shrink-0 pb-0.5 text-[12px] tabular-nums text-muted-foreground'>{view.usedPercentage}%</span>
      </div>

      <div
        aria-label={gridLabel}
        className='mt-2 grid grid-cols-[repeat(40,minmax(0,1fr))] gap-[3px]'
        onBlurCapture={handleGridBlur}
        role='img'
      >
        {view.cells.map((cell) => {
          const isHighlighted = cell.partId !== null && isTargetHighlighted(hoverTarget, cell.partId, cell.itemId)
          const shouldDim = hoverTarget !== null && !isHighlighted && cell.partId !== null
          const isCompacting = cell.partId === compactingPartId
          const cellClassName = clsx(
            styles.cell,
            getCellColorClass(cell.colorIndex),
            shouldDim ? 'opacity-25' : 'opacity-100',
            isHighlighted && hoverTarget && 'scale-110',
            isCompacting && styles.compacting
          )
          const cellStyle: CSSProperties = {
            animationDelay: isCompacting ? `${(cell.index % GRID_COLUMNS) * 4}ms` : undefined,
          }

          return (
            <span
              aria-hidden='true'
              className={cellClassName}
              data-item-id={cell.itemId}
              data-part-id={cell.partId ?? undefined}
              key={cell.index}
              style={cellStyle}
            />
          )
        })}
      </div>

      <div className='mt-3 space-y-0.5'>
        {parts.map((part, index) => (
          <PartRow
            colorIndex={index}
            isCompacting={compactingPartId === part.id}
            key={part.id}
            onCompact={part.compact ? handleCompact : undefined}
            onHover={setHoverTarget}
            onRemoveItem={onRemoveItem}
            part={part}
          />
        ))}
      </div>

      <footer className='mt-2 flex items-center justify-between gap-3 text-[12px]'>
        <span className='text-muted-foreground'>{formatContextTokens(view.remainingTokens)} free</span>
        <button className={styles.newChatButton} disabled={!onNewChat} onClick={onNewChat} type='button'>
          New chat <ArrowRight aria-hidden='true' className='size-3.5' />
        </button>
      </footer>
    </section>
  )
}

export type { ContextWindowItem, ContextWindowPart }
export default ContextWindow
