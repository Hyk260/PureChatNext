'use client'

import { ModelIcon } from '@pure/ui'
import { Flex, Typography, Switch } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo } from 'react'

import { useProviderConfigStore } from '../../store/useProviderConfigStore'
import { type ProviderId, type ProviderModelItem } from '../../types'

const styles = createStaticStyles(({ css }) => ({
  container: css`
    position: relative;
    padding-block: 10px;
    padding-inline: 8px;
    border-radius: ${cssVar.borderRadiusLG}px;
    transition: background 200ms ease-in-out;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  desc: css`
    flex: 1;
    min-width: 0;
  `,
  id: css`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: ${cssVar.colorTextDescription};
    font-size: 12px;
  `,
}))

interface ModelItemProps {
  model: ProviderModelItem
  provider: ProviderId
}

const ModelItem = memo<ModelItemProps>(({ model, provider }) => {
  const toggleModelEnabled = useProviderConfigStore((s) => s.toggleModelEnabled)

  return (
    <Flex align='center' className={styles.container} gap={12} justify='space-between' style={{ width: '100%' }}>
      <Flex align='center' className={styles.desc} gap={12}>
        <ModelIcon model={model.id} size={28} />
        <Flex vertical gap={2} style={{ minWidth: 0 }}>
          <Typography.Text ellipsis style={{ fontWeight: 500 }}>
            {model.displayName}
          </Typography.Text>
          <div className={styles.id}>{model.id}</div>
        </Flex>
      </Flex>

      <Switch
        checked={model.enabled}
        size='small'
        onChange={(next) => toggleModelEnabled(provider, model.id, next)}
      />
    </Flex>
  )
})

ModelItem.displayName = 'ProviderModelItem'

export default ModelItem
