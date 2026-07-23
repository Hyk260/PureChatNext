'use client'

import { Flex, App } from 'antd'
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
    <Flex vertical className={styles.page} gap={24} style={{ width: '100%' }}>
      <ProviderConfig id={id} />
      <ModelList id={id} />
    </Flex>
  </App>
))

ProviderDetailPage.displayName = 'ProviderDetailPage'

export default ProviderDetailPage
