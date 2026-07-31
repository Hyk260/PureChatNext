'use client'

import { Block, Flexbox, ProviderCombine, Switch, Text } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { useRouter } from '@/utils/navigation'
import { memo } from 'react'

import { getSettingsProviderMeta, isServerManagedProvider } from './const'
import { useProviderConfigStore } from './store/useProviderConfigStore'
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
  desc: css`
    min-height: 40px;
    margin: 0 !important;
    color: ${cssVar.colorTextSecondary};
  `,
  footer: css`
    padding-block-start: 12px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
  `,
}))

interface SettingsProviderCardProps {
  id: ProviderId
}

const SettingsProviderCard = memo<SettingsProviderCardProps>(({ id }) => {
  const router = useRouter()
  const meta = getSettingsProviderMeta(id)
  const enabled = useProviderConfigStore((s) => s.configs[id]?.enabled ?? false)
  const setEnabled = useProviderConfigStore((s) => s.setEnabled)
  const serverManaged = isServerManagedProvider(id)
  const isEnabled = serverManaged || enabled

  return (
    <Block
      className={styles.card}
      gap={16}
      padding={16}
      variant='outlined'
      width='100%'
      onClick={() => router.push(`/settings/provider/${id}`)}
    >
      <Flexbox gap={12} width='100%'>
        <ProviderCombine provider={id} size={28} style={{ flex: 'none' }} />
        <Flexbox gap={6}>
          <Text style={{ fontWeight: 600 }}>{meta.name}</Text>
          {meta.description ? (
            <Text as='p' className={styles.desc} ellipsis={{ rows: 2 }} style={{ marginBottom: 0, fontSize: 13 }}>
              {meta.description}
            </Text>
          ) : null}
        </Flexbox>
      </Flexbox>
      <Flexbox horizontal align='center' className={styles.footer} justify='space-between' width='100%'>
        <Text type='secondary' style={{ fontSize: 12 }}>
          {isEnabled ? '已启用' : '未启用'}
        </Text>
        {serverManaged ? null : (
          <Switch
            aria-label={`${enabled ? '停用' : '启用'} ${meta.name}`}
            checked={enabled}
            size='small'
            onChange={(checked, event) => {
              event.stopPropagation()
              setEnabled(id, checked)
            }}
            onClick={(_, event) => event.stopPropagation()}
          />
        )}
      </Flexbox>
    </Block>
  )
})

SettingsProviderCard.displayName = 'SettingsProviderCard'

export default SettingsProviderCard
