'use client'

import { memo } from 'react'
import type { CSSProperties } from 'react'

const BRAND_STROKE = '#0E2F5A'
const BRAND_DOT = '#8496AC'
const ON_DARK_STROKE = '#FFFFFF'
const ON_DARK_DOT = '#7FA0C8'

export type PureChatMarkVariant = 'color' | 'mono' | 'on-dark'

export interface PureChatMarkProps {
  className?: string
  size?: number
  style?: CSSProperties
  variant?: PureChatMarkVariant
}

const PureChatMark = memo<PureChatMarkProps>(({ className, size = 12, style, variant = 'color' }) => {
  const stroke = variant === 'mono' ? 'currentColor' : variant === 'on-dark' ? ON_DARK_STROKE : BRAND_STROKE
  const dot = variant === 'mono' ? 'currentColor' : variant === 'on-dark' ? ON_DARK_DOT : BRAND_DOT

  return (
    <svg
      aria-hidden
      className={className}
      height={size}
      viewBox='11.5 8 25 32'
      width={size}
      xmlns='http://www.w3.org/2000/svg'
      style={{ display: 'block', flex: 'none', ...style }}
    >
      <path
        d='M15 36.5V11.5h10.5a7.5 7.5 0 0 1 0 15H15'
        fill='none'
        stroke={stroke}
        strokeLinecap='square'
        strokeLinejoin='miter'
        strokeWidth={7}
      />
      <rect fill={dot} height={7} width={7} x={29} y={33} />
    </svg>
  )
})

PureChatMark.displayName = 'PureChatMark'

export default PureChatMark
