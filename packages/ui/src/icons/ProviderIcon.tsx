'use client'

import { ProviderIcon as LobeProviderIcon } from '@lobehub/icons'
import type { ProviderIconProps } from '@lobehub/icons'
import { memo } from 'react'

import PureHubMark from './PureHubMark'

const isPureHub = (provider?: string) => provider?.toLowerCase() === 'purehub'

const PureHubProviderIcon = memo<ProviderIconProps>(
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
          <PureHubMark size={size * 0.62} variant='on-dark' />
        </span>
      )
    }

    return (
      <PureHubMark
        className={className}
        size={size}
        style={style}
        variant={type === 'mono' ? 'mono' : 'color'}
      />
    )
  }
)

PureHubProviderIcon.displayName = 'PureHubProviderIcon'

const ProviderIcon = memo<ProviderIconProps>((props) => {
  if (isPureHub(props.provider)) {
    return <PureHubProviderIcon {...props} />
  }

  return <LobeProviderIcon {...props} />
})

ProviderIcon.displayName = 'ProviderIcon'

export default ProviderIcon
export type { ProviderIconProps }
