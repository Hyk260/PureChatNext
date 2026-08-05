'use client'

import { ProviderCombine as LobeProviderCombine } from '@lobehub/icons'
import type { ProviderCombineProps } from '@lobehub/icons'
import { Flexbox } from '@lobehub/ui'
import { memo } from 'react'

import PureHubMark from './PureHubMark'

const isPureHub = (provider?: string) => provider?.toLowerCase() === 'purehub'

const PureHubProviderCombine = memo<ProviderCombineProps>(
  ({ className, size = 12, style, type = 'color' }) => {
    return (
      <Flexbox
        horizontal
        align='center'
        className={className}
        flex='none'
        gap={Math.max(6, Math.round(size * 0.28))}
        style={{ height: size * 1.5, width: 'fit-content', ...style }}
      >
        <PureHubMark size={size} variant={type === 'mono' ? 'mono' : 'color'} />
        <span
          style={{
            color: 'inherit',
            fontSize: Math.max(12, Math.round(size * 0.72)),
            fontWeight: 600,
            letterSpacing: '-0.01em',
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          PureHub
        </span>
      </Flexbox>
    )
  }
)

PureHubProviderCombine.displayName = 'PureHubProviderCombine'

const ProviderCombine = memo<ProviderCombineProps>((props) => {
  if (isPureHub(props.provider)) {
    return <PureHubProviderCombine {...props} />
  }

  return <LobeProviderCombine {...props} />
})

ProviderCombine.displayName = 'ProviderCombine'

export default ProviderCombine
export type { ProviderCombineProps }
