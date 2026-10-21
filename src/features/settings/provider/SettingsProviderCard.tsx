'use client'

import { Block, Flex, Text } from '@pure/ui'
import { toast, createStaticStyles, cssVar, Switch, cx } from '@lobehub/ui'
import { useRouter } from 'next/navigation'
import { memo } from 'react'

import { updateCustomProvider } from './customProvidersApi'
import { getSettingsProviderMeta, isServerManagedProvider } from './const'
import ProviderMark from './ProviderMark'
import { useProviderConfigStore } from './store/useProviderConfigStore'
import { useCustomProviderRegistry } from './useCustomProviderRegistry'
import type { ProviderId } from './types'

const styles = createStaticStyles(({ css }) => ({
  card: css`
    cursor: pointer;
    height: 100%;
    overflow: hidden;
    border-radius: 12px;
    transition: box-shadow 0.2s ${cssVar.motionEaseInOut};

    &:hover {
      box-shadow: 0 0 1px 1px ${cssVar.colorFill} inset;
    }
  `,
  // 保留 createStaticStyles：依赖尚无对应 Tailwind 语义 token 的主题或运行时变量。
  desc: css`
    color: ${cssVar.colorTextSecondary};
  `,
  // 保留 createStaticStyles：依赖尚无对应 Tailwind 语义 token 的主题或运行时变量。
  footer: css`
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
  `,
}))

interface SettingsProviderCardProps {
  id: ProviderId
}

const SettingsProviderCard = memo<SettingsProviderCardProps>(({ id }) => {
  const router = useRouter()
  const registry = useCustomProviderRegistry()
  const customProviders = useProviderConfigStore((s) => s.customProviders)
  const setCustomProviders = useProviderConfigStore((s) => s.setCustomProviders)
  const availableCustomProviders = registry.data ?? customProviders
  const meta = getSettingsProviderMeta(id, availableCustomProviders)
  const customProvider = availableCustomProviders.find((provider) => provider.id === id)
  const enabled = useProviderConfigStore((s) => s.configs[id]?.enabled ?? false)
  const setEnabled = useProviderConfigStore((s) => s.setEnabled)
  const serverManaged = isServerManagedProvider(id)
  const isEnabled = serverManaged || enabled

  const handleEnabledChange = async (checked: boolean) => {
    setEnabled(id, checked)
    if (!customProvider) return

    try {
      const updated = await updateCustomProvider(id, { enabled: checked })
      const nextProviders = availableCustomProviders.map((provider) => (provider.id === id ? updated : provider))
      await registry.mutate(nextProviders, { revalidate: false })
      setCustomProviders(nextProviders)
    } catch (error) {
      setEnabled(id, !checked)
      toast.error(error instanceof Error ? error.message : '更新服务商状态失败')
    }
  }

  return (
    <Block
      className={styles.card}
      gap={16}
      padding={16}
      variant='outlined'
      width='100%'
      onClick={() => router.push(`/settings/provider/${id}`)}
    >
      <Flex className='flex-col gap-3 w-full'>
        <ProviderMark combined id={id} logo={meta.logo} name={meta.name} size={28} />
        <Flex className='flex-col gap-1.5'>
          <Text className='font-semibold'>{meta.name}</Text>
          {meta.description ? (
            <Text as='p' className={`${cx(styles.desc, 'min-h-[40px] !m-0')} text-[13px]`} ellipsis={{ rows: 2 }}>
              {meta.description}
            </Text>
          ) : null}
        </Flex>
      </Flex>
      <Flex className={[cx(styles.footer, 'pt-3'), 'flex-between w-full']}>
        <Text className='text-[12px]' type='secondary'>
          {isEnabled ? '已启用' : '未启用'}
        </Text>
        {serverManaged ? null : (
          <Switch
            aria-label={`${enabled ? '停用' : '启用'} ${meta.name}`}
            checked={enabled}
            size='small'
            onChange={(checked, event) => {
              event.stopPropagation()
              handleEnabledChange(checked)
            }}
            onClick={(_, event) => event.stopPropagation()}
          />
        )}
      </Flex>
    </Block>
  )
})

SettingsProviderCard.displayName = 'SettingsProviderCard'

export default SettingsProviderCard
