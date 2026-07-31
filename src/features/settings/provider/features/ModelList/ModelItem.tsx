'use client'

import { Flexbox, ModelIcon, Switch, Tag, Text } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo } from 'react'

import { useProviderConfigStore } from '../../store/useProviderConfigStore'
import type { ProviderId, ProviderModelItem } from '../../types'

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
  meta: css`
    min-width: 0;
  `,
}))

interface ModelItemProps {
  model: ProviderModelItem
  provider: ProviderId
}

const ModelItem = memo<ModelItemProps>(({ model, provider }) => {
  const toggleModelEnabled = useProviderConfigStore((s) => s.toggleModelEnabled)

  return (
    <Flexbox horizontal align='center' className={styles.container} gap={16} justify='space-between' width='100%'>
      <Flexbox horizontal align='center' className={styles.desc} gap={12}>
        <ModelIcon model={model.id} size={32} />
        <Flexbox className={styles.meta} gap={4}>
          <Text ellipsis style={{ fontWeight: 500 }}>
            {model.displayName}
          </Text>
          <Tag className={styles.id}>{model.id}</Tag>
        </Flexbox>
      </Flexbox>

      <Switch
        aria-label={`${model.enabled ? '停用' : '启用'} ${model.displayName}`}
        checked={model.enabled}
        size='small'
        onChange={(next) => toggleModelEnabled(provider, model.id, next)}
      />
    </Flexbox>
  )
})

ModelItem.displayName = 'ProviderModelItem'

export default ModelItem
