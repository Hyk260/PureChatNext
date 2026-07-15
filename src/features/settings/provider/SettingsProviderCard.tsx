'use client'

import { ProviderCombine } from '@lobehub/icons'
import { Block, Flexbox, Text } from '@lobehub/ui'
import { Switch } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { useRouter } from 'next/navigation'
import { memo } from 'react'

import { getSettingsProviderMeta } from './const'
import { useProviderConfigStore } from './store/useProviderConfigStore'
import type { ProviderId } from './types'

const styles = createStaticStyles(({ css }) => ({
  card: css`
    cursor: pointer;
    height: 100%;
    overflow: hidden;
    transition: border-color 0.2s ${cssVar.motionEaseInOut};

    &:hover {
      border-color: ${cssVar.colorBorder};
    }
  `,
  desc: css`
    margin: 0 !important;
    color: ${cssVar.colorTextSecondary};
  `,
}))

interface SettingsProviderCardProps {
  id: ProviderId
}

const SettingsProviderCard = memo<SettingsProviderCardProps>(({ id }) => {
  const router = useRouter()
  const meta = getSettingsProviderMeta(id)
  const enabled = useProviderConfigStore((s) => s.configs[id].enabled)
  const setEnabled = useProviderConfigStore((s) => s.setEnabled)

  return (
    <Block
      className={styles.card}
      gap={12}
      padding={16}
      variant='outlined'
      width='100%'
      onClick={() => router.push(`/settings/provider/${id}`)}
    >
      <Flexbox horizontal align='flex-start' justify='space-between' width='100%'>
        <ProviderCombine provider={id} size={28} style={{ flex: 'none' }} />
        <Switch
          checked={enabled}
          size='small'
          onChange={(checked, event) => {
            event.stopPropagation()
            setEnabled(id, checked)
          }}
          onClick={(_, event) => event.stopPropagation()}
        />
      </Flexbox>
      <Flexbox gap={6}>
        <Text weight={600}>{meta.name}</Text>
        {meta.description ? (
          <Text
            className={styles.desc}
            ellipsis={{ rows: 2 }}
            fontSize={13}
          >
            {meta.description}
          </Text>
        ) : null}
      </Flexbox>
    </Block>
  )
})

SettingsProviderCard.displayName = 'SettingsProviderCard'

export default SettingsProviderCard
