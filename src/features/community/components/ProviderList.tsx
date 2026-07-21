'use client'

import { Grid } from '@lobehub/ui'
import { memo } from 'react'

import { type DiscoverProviderItem } from '@/features/community/types'

import ProviderCard from './ProviderCard'
import ProviderEmpty from './ProviderEmpty'

export interface ProviderListProps {
  data?: DiscoverProviderItem[]
  rows?: number
}

const ProviderList = memo<ProviderListProps>(({ data = [], rows = 3 }) => {
  if (data.length === 0) return <ProviderEmpty />

  return (
    <Grid rows={rows} width='100%'>
      {data.map((item) => (
        <ProviderCard key={item.identifier} {...item} />
      ))}
    </Grid>
  )
})

ProviderList.displayName = 'ProviderList'

export default ProviderList
