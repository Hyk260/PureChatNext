import { Suspense } from 'react'

import SkillPage from '@/features/community/SkillPage'

export default function CommunitySkillPage() {
  return (
    <Suspense fallback={null}>
      <SkillPage />
    </Suspense>
  )
}
