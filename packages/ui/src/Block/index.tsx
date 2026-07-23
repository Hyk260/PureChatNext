'use client'

import { Flex, type FlexProps } from 'antd'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import { type CSSProperties, memo } from 'react'

export type BlockVariant = 'filled' | 'outlined' | 'borderless'

export type BlockProps = Omit<FlexProps, 'vertical'> & {
  clickable?: boolean
  glass?: boolean
  height?: number | string
  horizontal?: boolean
  padding?: number | string
  paddingBlock?: number | string
  paddingInline?: number | string
  shadow?: boolean
  variant?: BlockVariant
  width?: number | string
}

const styles = createStaticStyles(({ css }) => ({
  root: css`
    position: relative;
    border-radius: ${cssVar.borderRadius};
  `,
  clickable: css`
    cursor: pointer;
  `,
  glass: css`
    backdrop-filter: blur(10px);
  `,
  shadow: css`
    box-shadow:
      0 1px 2px ${cssVar.colorFillSecondary},
      0 1px 3px -1px ${cssVar.colorFillTertiary};
  `,
  borderless: css`
    border: none;
    background: none;
    box-shadow: none;
  `,
  borderlessHover: css`
    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  filled: css`
    background: ${cssVar.colorFillTertiary};
  `,
  filledHover: css`
    &:hover {
      background: ${cssVar.colorFillSecondary};
    }
  `,
  outlined: css`
    border: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};
  `,
  outlinedHover: css`
    &:hover {
      border-color: ${cssVar.colorBorder};
    }
  `,
}))

const VARIANT_CLASS: Record<BlockVariant, string> = {
  borderless: styles.borderless,
  filled: styles.filled,
  outlined: styles.outlined,
}

const VARIANT_HOVER_CLASS: Record<BlockVariant, string> = {
  borderless: styles.borderlessHover,
  filled: styles.filledHover,
  outlined: styles.outlinedHover,
}

/**
 * Flex-based surface container with filled / outlined / borderless variants.
 * Prefer this over ad-hoc Flex + background styles for clickable cards and nav rows.
 */
export const Block = memo<BlockProps>(
  ({
    children,
    className,
    clickable,
    glass,
    height,
    horizontal,
    onClick,
    padding,
    paddingBlock,
    paddingInline,
    shadow,
    style,
    variant = 'filled',
    width,
    ...rest
  }) => {
    const isClickable = clickable ?? Boolean(onClick)
    const mergedStyle: CSSProperties = {
      height,
      padding,
      paddingBlock,
      paddingInline,
      width,
      ...style,
    }

    return (
      <Flex
        className={cx(
          styles.root,
          VARIANT_CLASS[variant],
          isClickable && styles.clickable,
          isClickable && VARIANT_HOVER_CLASS[variant],
          glass && styles.glass,
          shadow && styles.shadow,
          className
        )}
        style={mergedStyle}
        vertical={!horizontal}
        onClick={onClick}
        {...rest}
      >
        {children}
      </Flex>
    )
  }
)

Block.displayName = 'Block'
