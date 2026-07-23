'use client'

import { Grid } from '@pure/ui'
import { memo } from 'react'

import { type DiscoverModelItem } from '@/features/community/types'

import ModelCard from './ModelCard'
import ModelEmpty from './ModelEmpty'

export interface ModelListProps {
  data?: DiscoverModelItem[]
  rows?: number
}

const ModelList = memo<ModelListProps>(({ data = [], rows = 3 }) => {
  if (data.length === 0) return <ModelEmpty />

  return (
    <Grid rows={rows} width='100%'>
      {data.map((item) => (
        <ModelCard key={item.identifier} {...item} />
      ))}
    </Grid>
  )
})

ModelList.displayName = 'ModelList'

export default ModelList
