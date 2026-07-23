'use client'

import { type LucideIcon, type LucideProps } from 'lucide-react'
import { type CSSProperties, type FC, type HTMLAttributes, type ReactNode, isValidElement, memo } from 'react'

export type IconSizeType = 'large' | 'middle' | 'small'

export type IconSizeConfig = {
  size?: number | string
  strokeWidth?: number
}

export type IconSize = number | IconSizeType | IconSizeConfig

export type IconProps = Omit<HTMLAttributes<HTMLSpanElement>, 'color' | 'children'> & {
  color?: string
  icon: LucideIcon | FC<LucideProps> | ReactNode
  size?: IconSize
  spin?: boolean
}

const SIZE_MAP: Record<IconSizeType, number> = {
  large: 24,
  middle: 20,
  small: 14,
}

const DEFAULT_STROKE = 2

export function calcIconSize(iconSize?: IconSize): {
  size: number | string
  strokeWidth: number
} {
  if (typeof iconSize === 'number') {
    return { size: iconSize, strokeWidth: DEFAULT_STROKE }
  }

  if (typeof iconSize === 'string') {
    return { size: SIZE_MAP[iconSize], strokeWidth: DEFAULT_STROKE }
  }

  if (iconSize) {
    return {
      size: iconSize.size ?? 24,
      strokeWidth: iconSize.strokeWidth ?? DEFAULT_STROKE,
    }
  }

  return { size: '1em', strokeWidth: DEFAULT_STROKE }
}

/** Renders a Lucide component ref or a prebuilt icon node. Prefer bare lucide for static icons. */
export const Icon = memo<IconProps>(({ icon, size: iconSize, color, className, style, spin, ...rest }) => {
  if (!icon) return null

  const { size, strokeWidth } = calcIconSize(iconSize)
  const mergedStyle: CSSProperties = {
    display: 'inline-flex',
    lineHeight: 0,
    ...style,
    ...(spin ? { animation: 'pure-ui-icon-spin 1s linear infinite' } : undefined),
  }

  let content: ReactNode
  if (isValidElement(icon)) {
    content = icon
  } else {
    const SvgIcon = icon as LucideIcon
    content = <SvgIcon color={color} size={size} strokeWidth={strokeWidth} />
  }

  return (
    <span className={className} role='img' style={mergedStyle} {...rest}>
      {content}
    </span>
  )
})

Icon.displayName = 'Icon'
