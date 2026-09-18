'use client'

import { Grid } from '@pure/ui'
import { memo, useCallback, useMemo, useState } from 'react'

import type { DiscoverSkillItem } from '@/features/community/types'

import CommunityEmpty from './CommunityEmpty'
import SkillCard from './SkillCard'
import SkillDetailModal from './SkillDetailModal'

export interface SkillListProps {
  data?: DiscoverSkillItem[]
  rows?: number
}

const SkillList = memo<SkillListProps>(({ data = [], rows = 3 }) => {
  const [selectedIdentifier, setSelectedIdentifier] = useState<string | null>(null)

  const selectedSkill = useMemo(
    () => data.find((item) => item.identifier === selectedIdentifier) ?? null,
    [data, selectedIdentifier]
  )

  const handleOpenDetail = useCallback((identifier: string) => {
    setSelectedIdentifier(identifier)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setSelectedIdentifier(null)
  }, [])

  if (data.length === 0) {
    return <CommunityEmpty description='试试调整分类或搜索关键词' title='暂无匹配技能' />
  }

  return (
    <>
      <Grid rows={rows} width='100%'>
        {data.map((item) => (
          <SkillCard key={item.identifier} {...item} onOpenDetail={handleOpenDetail} />
        ))}
      </Grid>
      <SkillDetailModal skill={selectedSkill} open={selectedIdentifier !== null} onClose={handleCloseDetail} />
    </>
  )
})

SkillList.displayName = 'SkillList'

export default SkillList
