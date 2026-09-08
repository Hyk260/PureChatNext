'use client'

import { createStaticStyles, cssVar } from 'antd-style'
import { forwardRef } from 'react'
import type { CSSProperties, ComponentPropsWithoutRef, ReactNode } from 'react'

type ClassNameValue = string | false | null | undefined | ClassNameValue[]

type ContentPosition = 'baseline' | 'center' | 'end' | 'flex-end' | 'flex-start' | 'start' | 'stretch'
type FlexDirection = 'horizontal' | 'horizontal-reverse' | 'vertical' | 'vertical-reverse'

export type BlockVariant = 'borderless' | 'filled' | 'outlined'

export type BlockProps = Omit<ComponentPropsWithoutRef<'div'>, 'className' | 'title'> & {
  align?: ContentPosition
  allowShrink?: boolean
  children?: ReactNode
  className?: ClassNameValue
  clickable?: boolean
  direction?: FlexDirection
  distribution?: CSSProperties['justifyContent']
  flex?: number | string
  gap?: number | string
  glass?: boolean
  height?: number | string
  horizontal?: boolean
  justify?: CSSProperties['justifyContent']
  padding?: number | string
  paddingBlock?: number | string
  paddingInline?: number | string
  shadow?: boolean
  /** Native HTML title tooltip; string only (ReactNode titles are not supported). */
  title?: string
  variant?: BlockVariant
  width?: number | string
  wrap?: CSSProperties['flexWrap']
}

const styles = createStaticStyles(({ css }) => ({
  borderless: css`
    border: none;
    background: none;
    box-shadow: none;
  `,
  clickable: css`
    cursor: pointer;
  `,
  clickableBorderless: css`
    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  clickableFilled: css`
    &:hover {
      background: ${cssVar.colorFillSecondary};
    }
  `,
  clickableOutlined: css`
    &:hover {
      border-color: ${cssVar.colorBorder};
    }
  `,
  filled: css`
    background: ${cssVar.colorFillTertiary};
  `,
  flex: css`
    display: flex;
  `,
  glass: css`
    backdrop-filter: saturate(150%) blur(10px);
  `,
  outlined: css`
    border: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};
  `,
  root: css`
    position: relative;
    box-sizing: border-box;
    border-radius: ${cssVar.borderRadius};
  `,
  shadow: css`
    box-shadow:
      0 1px 0 -1px ${cssVar.colorBorder},
      0 1px 2px -0.5px ${cssVar.colorBorder},
      0 2px 2px -1px ${cssVar.colorBorderSecondary},
      0 3px 6px -4px ${cssVar.colorBorderSecondary};
  `,
}))

const mergeClassNames = (...values: ClassNameValue[]) => {
  const classNames: string[] = []

  const append = (value: ClassNameValue) => {
    if (!value) return
    if (Array.isArray(value)) {
      value.forEach(append)
      return
    }
    classNames.push(value)
  }

  values.forEach(append)
  return classNames.join(' ')
}

const toCssValue = (value: number | string) => (typeof value === 'number' ? `${value}px` : value)

const resolveFlexDirection = (direction?: FlexDirection, horizontal?: boolean): CSSProperties['flexDirection'] => {
  if (direction === 'horizontal' || horizontal) return 'row'
  if (direction === 'horizontal-reverse') return 'row-reverse'
  if (direction === 'vertical-reverse') return 'column-reverse'
  if (direction === 'vertical') return 'column'
  return 'column'
}

const hasFlexLayoutProps = ({
  align,
  direction,
  distribution,
  flex,
  gap,
  horizontal,
  justify,
  padding,
  paddingBlock,
  paddingInline,
  wrap,
}: Pick<
  BlockProps,
  | 'align'
  | 'direction'
  | 'distribution'
  | 'flex'
  | 'gap'
  | 'horizontal'
  | 'justify'
  | 'padding'
  | 'paddingBlock'
  | 'paddingInline'
  | 'wrap'
>) =>
  Boolean(
    align ||
      direction ||
      distribution ||
      flex !== undefined ||
      gap !== undefined ||
      horizontal ||
      justify ||
      padding !== undefined ||
      paddingBlock !== undefined ||
      paddingInline !== undefined ||
      wrap
  )

/**
 * Visual container with variant chrome.
 * Layout is Tailwind/`className`-first by default (no `lobe-flex`).
 * Legacy Flex props still map to inline styles when provided.
 */
export const Block = forwardRef<HTMLDivElement, BlockProps>(
  (
    {
      align,
      allowShrink,
      children,
      className,
      clickable,
      direction,
      distribution,
      flex,
      gap,
      glass,
      height,
      horizontal,
      justify,
      padding,
      paddingBlock,
      paddingInline,
      shadow,
      style,
      variant = 'filled',
      width,
      wrap,
      ...rest
    },
    ref
  ) => {
    const useFlexLayout = hasFlexLayoutProps({
      align,
      direction,
      distribution,
      flex,
      gap,
      horizontal,
      justify,
      padding,
      paddingBlock,
      paddingInline,
      wrap,
    })

    const layoutStyle: CSSProperties = {
      ...(useFlexLayout
        ? {
            flexDirection: resolveFlexDirection(direction, horizontal),
            ...(align ? { alignItems: align } : {}),
            ...(justify || distribution ? { justifyContent: justify || distribution } : {}),
            ...(gap !== undefined ? { gap: toCssValue(gap) } : {}),
            ...(padding !== undefined ? { padding: toCssValue(padding) } : {}),
            ...(paddingBlock !== undefined ? { paddingBlock: toCssValue(paddingBlock) } : {}),
            ...(paddingInline !== undefined ? { paddingInline: toCssValue(paddingInline) } : {}),
            ...(wrap !== undefined ? { flexWrap: wrap } : {}),
            ...(flex !== undefined ? { flex: String(flex) } : {}),
          }
        : {}),
      ...(height !== undefined ? { height: toCssValue(height) } : {}),
      ...(width !== undefined ? { width: toCssValue(width) } : {}),
      ...(allowShrink ? { minWidth: 0 } : {}),
      ...style,
    }

    return (
      <div
        ref={ref}
        {...rest}
        className={mergeClassNames(
          styles.root,
          variant === 'outlined' && styles.outlined,
          variant === 'filled' && styles.filled,
          variant === 'borderless' && styles.borderless,
          clickable && styles.clickable,
          clickable && variant === 'outlined' && styles.clickableOutlined,
          clickable && variant === 'filled' && styles.clickableFilled,
          clickable && variant === 'borderless' && styles.clickableBorderless,
          glass && styles.glass,
          shadow && styles.shadow,
          useFlexLayout && styles.flex,
          className
        )}
        style={layoutStyle}
      >
        {children}
      </div>
    )
  }
)

Block.displayName = 'Block'

// Keep named export parity with previous re-export surface.
export default Block
