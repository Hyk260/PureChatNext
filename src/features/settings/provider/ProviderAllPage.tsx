'use client'

import { Flex, Typography } from 'antd'
import { createStaticStyles } from 'antd-style'
import { memo, useMemo } from 'react'

import { SETTINGS_PROVIDER_IDS } from './const'
import SettingsProviderCard from './SettingsProviderCard'
import { useProviderConfigStore } from './store/useProviderConfigStore'
import { type ProviderId } from './types'

const styles = createStaticStyles(({ css }) => ({
  grid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;

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
  `,
}))

const ProviderSection = memo<{
  ids: readonly ProviderId[]
  title: string
}>(({ ids, title }) => (
  <Flex vertical gap={16}>
    <Flex align='center' gap={8}>
      <Typography.Text style={{ fontSize: 18, fontWeight: 600 }}>{title}</Typography.Text>
      <Typography.Text type='secondary' style={{ fontSize: 14 }}>
        {ids.length}
      </Typography.Text>
    </Flex>
    {ids.length > 0 ? (
      <div className={styles.grid}>
        {ids.map((id) => (
          <SettingsProviderCard id={id} key={id} />
        ))}
      </div>
    ) : (
      <Typography.Text type='secondary'>暂无服务商</Typography.Text>
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
    <Flex vertical className={styles.page} gap={32} style={{ width: '100%' }}>
      <ProviderSection ids={enabledIds} title='已启用服务商' />
      <ProviderSection ids={disabledIds} title='未启用服务商' />
    </Flex>
  )
})

ProviderAllPage.displayName = 'ProviderAllPage'

export default ProviderAllPage
