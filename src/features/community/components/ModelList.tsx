'use client'

import { Grid } from '@pure/ui'
import { memo } from 'react'

import type { DiscoverModelItem } from '@/features/community/types'

import ModelCard from './ModelCard'
import CommunityEmpty from './CommunityEmpty'

export interface ModelListProps {
  data?: DiscoverModelItem[]
  rows?: number
}

const ModelList = memo<ModelListProps>(({ data = [], rows = 3 }) => {
  if (data.length === 0) {
    return <CommunityEmpty description='模型列表即将上线，敬请期待' title='暂无模型' />
  }

  return (
    <Grid rows={rows} width='100%'>
      {data.map((item) => (
        <ModelCard key={item.id} {...item} />
      ))}
    </Grid>
  )
})

ModelList.displayName = 'ModelList'

export default ModelList
