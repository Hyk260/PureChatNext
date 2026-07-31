'use client'

import { memo } from 'react'
import type { ReactNode } from 'react'

import { Flexbox } from '@pure/ui'
import ModelLabel from '@/features/chat/ModelLabel'

import SendButton from './SendButton'
import type { SendButtonProps } from './SendButton'

export interface SendAreaProps extends SendButtonProps {
  /** Extra nodes rendered before the model label */
  prefix?: ReactNode
  showModelLabel?: boolean
}

/**
 * Right-side action strip for chat inputs.
 * Layout: ChatInput send area with model label on the right.
 */
const SendArea = memo<SendAreaProps>(
  ({ prefix, showModelLabel = true, disabled, generating, loading, shape, size, onClick, onStop }) => {
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
  }
)

SendArea.displayName = 'SendArea'

export default SendArea
export { default as SendButton } from './SendButton'
export type { SendButtonProps } from './SendButton'
