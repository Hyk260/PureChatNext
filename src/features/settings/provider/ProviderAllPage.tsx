'use client'

import { Flex, Grid, Tag, Text } from '@pure/ui'
import { createStaticStyles } from 'antd-style'
import { memo, useMemo } from 'react'

import { SETTINGS_PROVIDER_IDS } from './const'
import SettingsProviderCard from './SettingsProviderCard'
import { useProviderConfigStore } from './store/useProviderConfigStore'
import type { ProviderId } from './types'

const styles = createStaticStyles(({ css }) => ({
  grid: css`
    grid-template-columns: repeat(3, minmax(0, 1fr));

    @media (max-width: 1200px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  `,
  page: css`
    width: 100%;
    padding-block: 24px 64px;
    padding-inline: 24px;

    @media (max-width: 768px) {
      padding-block: 20px 48px;
      padding-inline: 16px;
    }
  `,
}))

const ProviderSection = memo<{
  ids: readonly ProviderId[]
  title: string
}>(({ ids, title }) => (
  <Flex className='flex-col gap-4'>
    <Flex className='flex-row items-center gap-2'>
      <Text style={{ fontSize: 18, fontWeight: 600 }}>{title}</Text>
      <Tag>{ids.length}</Tag>
    </Flex>
    {ids.length > 0 ? (
      <Grid className={styles.grid} gap={16} rows={3}>
        {ids.map((id) => (
          <SettingsProviderCard id={id} key={id} />
        ))}
      </Grid>
    ) : (
      <Text type='secondary'>暂无服务商</Text>
    )}
  </Flex>
))

ProviderSection.displayName = 'ProviderSection'

const ProviderAllPage = memo(() => {
  const configs = useProviderConfigStore((s) => s.configs)

  const { enabledIds, disabledIds } = useMemo(() => {
    const enabled = SETTINGS_PROVIDER_IDS.filter((id) => configs[id]?.enabled)
    const disabled = SETTINGS_PROVIDER_IDS.filter((id) => !configs[id]?.enabled)
    return { disabledIds: disabled, enabledIds: enabled }
  }, [configs])

  return (
    <Flex className={[styles.page, 'flex-col gap-8 w-full']}>
      <ProviderSection ids={enabledIds} title='已启用服务商' />
      <ProviderSection ids={disabledIds} title='未启用服务商' />
    </Flex>
  )
})

ProviderAllPage.displayName = 'ProviderAllPage'

export default ProviderAllPage
