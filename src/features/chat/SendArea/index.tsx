'use client'

import { Flexbox } from '@lobehub/ui'
import { memo, type ReactNode } from 'react'

import ModelLabel from '@/features/chat/ModelLabel'

import SendButton, { type SendButtonProps } from './SendButton'

export interface SendAreaProps extends SendButtonProps {
  /** Extra nodes rendered before the model label */
  prefix?: ReactNode
  /** Home SendArea uses modelLabel (lobe `rightActions: ['modelLabel']`) */
  showModelLabel?: boolean
}

/**
 * Right-side action strip for chat inputs.
 * Layout mirrors lobe-chat `ChatInput/SendArea` + home `rightActions: ['modelLabel']`.
 */
const SendArea = memo<SendAreaProps>(
  ({
    prefix,
    showModelLabel = true,
    disabled,
    generating,
    loading,
    shape,
    size,
    onClick,
    onStop,
  }) => {
    return (
      <Flexbox horizontal align='center' flex='none' gap={12}>
        {prefix}
        {showModelLabel ? <ModelLabel /> : null}
        <SendButton
          disabled={disabled}
          generating={generating}
          loading={loading}
          shape={shape}
          size={size}
          onClick={onClick}
          onStop={onStop}
        />
      </Flexbox>
    )
  },
)

SendArea.displayName = 'SendArea'

export default SendArea
export { default as SendButton } from './SendButton'
export type { SendButtonProps } from './SendButton'
