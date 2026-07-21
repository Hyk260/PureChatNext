'use client'

import { Flexbox } from '@lobehub/ui'
import { App } from 'antd'
import { memo } from 'react'

import { providerDetailStyles as styles } from './styles'
import { type ProviderId } from './types'
import ModelList from './features/ModelList'
import ProviderConfig from './features/ProviderConfig'

interface ProviderDetailPageProps {
  id: ProviderId
}

const ProviderDetailPage = memo<ProviderDetailPageProps>(({ id }) => (
  <App>
    <Flexbox className={styles.page} gap={24} width='100%'>
      <ProviderConfig id={id} />
      <ModelList id={id} />
    </Flexbox>
  </App>
))

ProviderDetailPage.displayName = 'ProviderDetailPage'

export default ProviderDetailPage
