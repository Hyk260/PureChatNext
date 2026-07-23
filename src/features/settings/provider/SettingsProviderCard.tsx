'use client'

import { Block, ProviderCombine } from '@pure/ui'
import { Flex, Typography, Switch } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { useRouter } from '@/utils/navigation'
import { memo } from 'react'

import { getSettingsProviderMeta } from './const'
import { useProviderConfigStore } from './store/useProviderConfigStore'
import { type ProviderId } from './types'

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
  const enabled = useProviderConfigStore((s) => s.configs[id]?.enabled ?? false)
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
      <Flex align='flex-start' justify='space-between' style={{ width: '100%' }}>
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
      </Flex>
      <Flex vertical gap={6}>
        <Typography.Text style={{ fontWeight: 600 }}>{meta.name}</Typography.Text>
        {meta.description ? (
          <Typography.Paragraph className={styles.desc} ellipsis={{ rows: 2 }} style={{ marginBottom: 0, fontSize: 13 }}>
            {meta.description}
          </Typography.Paragraph>
        ) : null}
      </Flex>
    </Block>
  )
})

SettingsProviderCard.displayName = 'SettingsProviderCard'

export default SettingsProviderCard
