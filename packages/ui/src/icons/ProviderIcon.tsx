'use client'

import { ProviderIcon as LobeProviderIcon } from '@lobehub/icons'
import type { ProviderIconProps } from '@lobehub/icons'
import { memo } from 'react'

import PureChatMark from './PureChatMark'

/** Accept legacy `purehub` so historical message metadata keeps the brand icon. */
const isPureChat = (provider?: string) => {
  const id = provider?.toLowerCase()
  return id === 'purechat' || id === 'purehub'
}

const PureChatProviderIcon = memo<ProviderIconProps>(
  ({ className, shape = 'circle', size = 12, style, type = 'avatar' }) => {
    if (type === 'avatar') {
      return (
        <span
          className={className}
          style={{
            alignItems: 'center',
            background: '#0E2F5A',
            borderRadius: shape === 'circle' ? '50%' : Math.floor(size * 0.1),
            display: 'inline-flex',
            flex: 'none',
            height: size,
            justifyContent: 'center',
            width: size,
            ...style,
          }}
        >
          <PureChatMark size={size * 0.62} variant='on-dark' />
        </span>
      )
    }

    return (
      <PureChatMark
        className={className}
        size={size}
        style={style}
        variant={type === 'mono' ? 'mono' : 'color'}
      />
    )
  }
)

PureChatProviderIcon.displayName = 'PureChatProviderIcon'

const ProviderIcon = memo<ProviderIconProps>((props) => {
  if (isPureChat(props.provider)) {
    return <PureChatProviderIcon {...props} />
  }

  return <LobeProviderIcon {...props} />
})

ProviderIcon.displayName = 'ProviderIcon'

export default ProviderIcon
export type { ProviderIconProps }
