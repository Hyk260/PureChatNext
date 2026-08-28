'use client'

import { memo } from 'react'
import type { ReactNode } from 'react'

import { Flex } from '@pure/ui'
import ModelLabel from '@/features/chat/ModelLabel'

import SendButton from './SendButton'
import type { SendButtonProps } from './SendButton'

export interface SendAreaProps extends SendButtonProps {
  /** Extra nodes rendered before the model label */
  prefix?: ReactNode
  modelLabelClassName?: string
  showModelLabel?: boolean
}

/**
 * Right-side action strip for chat inputs.
 * Layout: ChatInput send area with model label on the right.
 */
const SendArea = memo<SendAreaProps>(
  ({
    prefix,
    modelLabelClassName,
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
      <Flex className='flex-row items-center flex-none gap-3'>
        {prefix}
        {showModelLabel ? (
          <span className={modelLabelClassName}>
            <ModelLabel />
          </span>
        ) : null}
        <SendButton
          generating={generating}
          loading={loading}
          shape={shape}
          size={size}
          onClick={onClick}
          onStop={onStop}
        />
      </Flex>
    )
  }
)

SendArea.displayName = 'SendArea'

export default SendArea
export { default as SendButton } from './SendButton'
export type { SendButtonProps } from './SendButton'
