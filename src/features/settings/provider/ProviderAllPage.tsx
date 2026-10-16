'use client'

import { Flex, Grid, Tag, Text } from '@pure/ui'
import { createStaticStyles } from 'antd-style'
import { memo, useMemo } from 'react'

import { SETTINGS_PROVIDER_IDS } from './const'
import SettingsProviderCard from './SettingsProviderCard'
import { useProviderConfigStore } from './store/useProviderConfigStore'
import { useCustomProviderRegistry } from './useCustomProviderRegistry'
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
    <Flex className='items-center gap-2'>
      <Text className='text-[18px] font-semibold'>{title}</Text>
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
  const storedCustomProviders = useProviderConfigStore((s) => s.customProviders)
  const registry = useCustomProviderRegistry()
  const customProviders = registry.data ?? storedCustomProviders
  const allProviderIds = useMemo(
    () => [...SETTINGS_PROVIDER_IDS, ...customProviders.map((provider) => provider.id)],
    [customProviders]
  )
  const enabledCustomIds = useMemo(
    () => new Set(customProviders.filter((provider) => provider.enabled).map((provider) => provider.id)),
    [customProviders]
  )

  const { enabledIds, disabledIds } = useMemo(() => {
    const enabled = allProviderIds.filter((id) => configs[id]?.enabled ?? enabledCustomIds.has(id))
    const disabled = allProviderIds.filter((id) => !(configs[id]?.enabled ?? enabledCustomIds.has(id)))
    return { disabledIds: disabled, enabledIds: enabled }
  }, [allProviderIds, configs, enabledCustomIds])

  return (
    <Flex className={[styles.page, 'flex-col gap-8 w-full']}>
      <ProviderSection ids={enabledIds} title='已启用服务商' />
      <ProviderSection ids={disabledIds} title='未启用服务商' />
    </Flex>
  )
})

ProviderAllPage.displayName = 'ProviderAllPage'

export default ProviderAllPage
