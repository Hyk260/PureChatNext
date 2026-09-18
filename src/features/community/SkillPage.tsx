'use client'

import { memo, useMemo } from 'react'

import { useSearchParams } from 'next/navigation'

import { COMMUNITY_SKILLS, filterCommunitySkills } from '@/const/community/skills'

import { CommunityCollectionPage } from './components/CommunityCollectionPage'
import SkillCategory from './components/SkillCategory'
import SkillList from './components/SkillList'

const SkillPage = memo(() => {
  const searchParams = useSearchParams()
  const category = searchParams.get('category')
  const q = searchParams.get('q')

  const data = useMemo(() => filterCommunitySkills(COMMUNITY_SKILLS, { category, q }), [category, q])

  return (
    <CommunityCollectionPage data={data} sidebar={<SkillCategory />}>
      {(pageData) => <SkillList data={pageData} />}
    </CommunityCollectionPage>
  )
})

SkillPage.displayName = 'SkillPage'

export default SkillPage
