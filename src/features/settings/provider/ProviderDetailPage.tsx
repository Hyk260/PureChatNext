'use client'

import { ActionIcon, Flex, ProviderIcon, Text } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from '@/utils/navigation'
import { memo } from 'react'

import { getSettingsProviderMeta } from './const'
import { providerDetailStyles as styles } from './styles'
import type { ProviderId } from './types'
import ModelList from './features/ModelList'
import ProviderConfig from './features/ProviderConfig'

interface ProviderDetailPageProps {
  id: ProviderId
}

const localStyles = createStaticStyles(({ css }) => ({
  mobileHeader: css`
    display: none;

    @media (max-width: 768px) {
      display: flex;
      position: sticky;
      z-index: 20;
      inset-block-start: 0;
      padding-block: 8px;
      background: ${cssVar.colorBgContainer};
      border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    }
  `,
}))

const ProviderDetailPage = memo<ProviderDetailPageProps>(({ id }) => {
  const router = useRouter()
  const meta = getSettingsProviderMeta(id)

  return (
    <Flex className={[styles.page, 'flex-col gap-6 w-full']}>
      <Flex className={[localStyles.mobileHeader, 'flex-row items-center gap-2']}>
        <ActionIcon
          aria-label='返回全部服务商'
          icon={ArrowLeft}
          size='small'
          title='返回全部服务商'
          onClick={() => router.push('/settings/provider/all')}
        />
        <ProviderIcon provider={id} size={20} type='color' />
        <Text strong>{meta.name}</Text>
      </Flex>
      <ProviderConfig id={id} />
      <ModelList id={id} />
    </Flex>
  )
})

ProviderDetailPage.displayName = 'ProviderDetailPage'

export default ProviderDetailPage
