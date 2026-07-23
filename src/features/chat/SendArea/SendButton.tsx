'use client'

import { Button } from 'antd'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import { type CSSProperties, type MouseEventHandler, memo } from 'react'

const prefixCls = 'ant'

const iconStyles = createStaticStyles(({ css }) => ({
  icon: css`
    flex: none;
    line-height: 1;
  `,
}))

/** Send button idle icon */
const SendIcon = ({ size = '1em' }: { size?: number | string }) => (
  <svg
    className={cx('anticon', iconStyles.icon)}
    fill='currentColor'
    fillRule='evenodd'
    height={size}
    viewBox='0 0 14 14'
    width={size}
    xmlns='http://www.w3.org/2000/svg'
  >
    <path d='M.743 3.773c-.818-.555-.422-1.834.567-1.828l11.496.074a1 1 0 01.837 1.538l-6.189 9.689c-.532.833-1.822.47-1.842-.518L5.525 8.51a1 1 0 01.522-.9l1.263-.686a.808.808 0 00-.772-1.42l-1.263.686a1 1 0 01-1.039-.051L.743 3.773z' />
  </svg>
)

/** Send button stop icon */
const StopIcon = ({ size = '1.5em' }: { size?: number | string }) => (
  <svg
    className={cx('anticon', iconStyles.icon)}
    color='currentColor'
    height={size}
    viewBox='0 0 1024 1024'
    width={size}
    xmlns='http://www.w3.org/2000/svg'
  >
    <g fill='none'>
      <circle
        cx='512'
        cy='512'
        fill='none'
        r='426'
        stroke={cssVar.colorBorder}
        strokeWidth='72'
      />
      <rect fill='currentColor' height='252' rx='24' ry='24' width='252' x='386' y='386' />
      <path
        d='M938.667 512C938.667 276.359 747.64 85.333 512 85.333'
        stroke='currentColor'
        strokeLinecap='round'
        strokeWidth='73'
      >
        <animateTransform
          attributeName='transform'
          dur='1s'
          from='0 512 512'
          repeatCount='indefinite'
          to='360 512 512'
          type='rotate'
        />
      </path>
    </g>
  </svg>
)

const styles = createStaticStyles(({ css }) => ({
  button: css`
    &.${prefixCls}-btn {
      flex: none;
      width: var(--send-button-size, 32px) !important;
      height: var(--send-button-size, 32px);
      padding-inline: 0 !important;
    }
  `,
  disabled: css`
    &.${prefixCls}-btn {
      cursor: default;
      border-color: ${cssVar.colorBorderSecondary};
      background: transparent;
    }
  `,
  loadingButton: css`
    &.${prefixCls}-btn {
      flex: none;
      height: var(--send-button-size, 32px);
      padding-inline: 0 !important;
    }
  `,
}))

export interface SendButtonProps {
  disabled?: boolean
  generating?: boolean
  loading?: boolean
  shape?: 'default' | 'round'
  size?: number
  onClick?: MouseEventHandler<HTMLElement>
  onStop?: MouseEventHandler<HTMLElement>
}

const SendButton = memo<SendButtonProps>(
  ({
    disabled,
    generating,
    loading,
    shape = 'round',
    size = 32,
    onClick,
    onStop,
  }) => {
    const cssVariables = { '--send-button-size': `${size}px` } as CSSProperties

    if (generating) {
      return (
        <Button
          className={styles.loadingButton}
          shape={shape}
          style={{ ...cssVariables, width: size }}
          title='停止'
          variant='filled'
          onClick={(event) => {
            event.stopPropagation()
            event.preventDefault()
            onStop?.(event)
          }}
        >
          <StopIcon size={size * 0.75} />
        </Button>
      )
    }

    if (loading) {
      return (
        <Button
          className={styles.loadingButton}
          disabled
          loading
          shape={shape}
          style={{ ...cssVariables, width: size }}
          type='primary'
        />
      )
    }

    return (
      <Button
        className={cx(styles.button, disabled && styles.disabled)}
        disabled={disabled}
        icon={<SendIcon />}
        shape={shape}
        style={cssVariables}
        title='发送'
        type='primary'
        onClick={(event) => {
          event.stopPropagation()
          event.preventDefault()
          if (disabled) return
          onClick?.(event)
        }}
      />
    )
  },
)

SendButton.displayName = 'SendButton'

export default SendButton
