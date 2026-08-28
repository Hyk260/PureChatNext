'use client'

import { memo, useMemo } from 'react'

import ModelCategory from '@/features/community/components/ModelCategory'
import ModelList from '@/features/community/components/ModelList'
import { CommunityCollectionPage } from '@/features/community/components/CommunityCollectionPage'
import { COMMUNITY_MODELS, filterCommunityModels } from '@/const/community/models'
import { useSearchParams } from '@/utils/navigation'

const ModelPage = memo(() => {
  const searchParams = useSearchParams()
  const category = searchParams.get('category')
  const q = searchParams.get('q')

  const data = useMemo(() => filterCommunityModels(COMMUNITY_MODELS, { category, q }), [category, q])

  return (
    <CommunityCollectionPage data={data} sidebar={<ModelCategory />}>
      {(pageData) => <ModelList data={pageData} />}
    </CommunityCollectionPage>
  )
})

ModelPage.displayName = 'ModelPage'

export default ModelPage
