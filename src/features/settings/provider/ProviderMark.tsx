'use client'

import { BUILTIN_PROVIDER_IDS } from '@pure/const'

import { ProviderCombine, ProviderIcon } from '@pure/ui'
import { Avatar } from '@lobehub/ui'
import { memo } from 'react'

interface ProviderMarkProps {
  combined?: boolean
  id: string
  logo?: string | null
  name: string
  size: number
}

const ProviderMark = memo<ProviderMarkProps>(({ combined = false, id, logo, name, size }) => {
  if (logo) {
    return (
      <Avatar
        alt={name}
        avatar={logo}
        className='shrink-0'
        shape='square'
        size={size}
        title={name.slice(0, 1).toUpperCase()}
      />
    )
  }

  if (!BUILTIN_PROVIDER_IDS.has(id)) {
    return (
      <Avatar className='shrink-0' shape='square' size={size} title={name.slice(0, 1).toUpperCase()} />
    )
  }

  return combined ? (
    <ProviderCombine provider={id} size={size} />
  ) : (
    <ProviderIcon provider={id} size={size} type='color' />
  )
})

ProviderMark.displayName = 'ProviderMark'

export default ProviderMark
