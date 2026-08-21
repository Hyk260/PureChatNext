'use client'

import { Flexbox, Icon, ModelIcon, Switch, Tag, Text, Tooltip } from '@pure/ui'
import { getAiModel } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'
import { formatTokenNumber } from '@pure/utils/client'
import { createStaticStyles, cssVar } from 'antd-style'
import { Check, CircleX, Eye, Lightbulb, Loader2, Wrench } from 'lucide-react'
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
  metadata: css`
    color: ${cssVar.colorTextSecondary};
    font-size: 12px;
  `,
  status: css`
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 4px;
    min-width: 48px;
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
  const card = getAiModel(provider as ModelProviderId, model.id)
  const pricing = card?.pricing
  const metadata = [
    card?.releasedAt ? `发布于 ${card.releasedAt}` : undefined,
    pricing ? `输入 ${formatPrice(pricing.currency, pricing.textInput)}/M` : undefined,
    pricing ? `输出 ${formatPrice(pricing.currency, pricing.textOutput)}/M` : undefined,
  ].filter(Boolean)

  const health = model.enabled ? model.health : undefined
  const healthLabel =
    health?.status === 'success'
      ? `检查成功${typeof health.durationMs === 'number' ? ` · ${formatDuration(health.durationMs)}` : ''}`
      : health?.status === 'failure'
        ? `检查失败：${health.message || '未知原因'}`
        : health?.status === 'checking'
          ? '正在检查'
          : '未检测'

  const healthStatus = (
    <span className={styles.status}>
      {health?.status === 'success' ? <Check color={cssVar.colorSuccess} size={16} /> : null}
      {health?.status === 'failure' ? <CircleX color={cssVar.colorError} size={16} /> : null}
      {health?.status === 'checking' ? (
        <Loader2 className='animate-spin' color={cssVar.colorPrimary} size={16} />
      ) : null}
      {health?.status !== 'success' && health?.status !== 'failure' && health?.status !== 'checking' ? '—' : null}
      {health?.status === 'success' && typeof health.durationMs === 'number' ? formatDuration(health.durationMs) : null}
    </span>
  )

  return (
    <Flexbox horizontal align='center' className={styles.container} gap={16} justify='space-between' width='100%'>
      <Flexbox horizontal align='center' className={styles.desc} gap={12}>
        <ModelIcon model={model.id} size={32} />
        <Flexbox className={styles.meta} gap={4}>
          <Flexbox horizontal align='center' gap={8} style={{ minWidth: 0 }}>
            <Text ellipsis style={{ fontWeight: 500 }}>
              {model.displayName}
            </Text>
            <Tag className={styles.id}>{model.id}</Tag>
          </Flexbox>
          {metadata.length > 0 ? <Text className={styles.metadata}>{metadata.join(' · ')}</Text> : null}
          {card ? <ModelCapabilityTags card={card} /> : null}
        </Flexbox>
      </Flexbox>

      <Tooltip title={healthLabel}>{healthStatus}</Tooltip>

      <Switch
        aria-label={`${model.enabled ? '停用' : '启用'} ${model.displayName}`}
        checked={model.enabled}
        size='small'
        onChange={(next) => toggleModelEnabled(provider, model.id, next)}
      />
    </Flexbox>
  )
})

const formatPrice = (currency: 'CNY' | 'USD', amount: number) => {
  const value = amount.toFixed(amount >= 10 ? 1 : 2).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
  return `${currency === 'USD' ? '$' : '¥'}${value}`
}

const formatDuration = (durationMs: number) => `${(durationMs / 1000).toFixed(2)}s`

const ModelCapabilityTags = ({ card }: { card: NonNullable<ReturnType<typeof getAiModel>> }) => {
  const abilities = card.abilities
  const tokens = card.contextWindowTokens
  if (!abilities?.functionCall && !abilities?.reasoning && !abilities?.vision && tokens == null) return null

  return (
    <Flexbox horizontal gap={3}>
      {abilities?.functionCall ? (
        <Tooltip title='支持工具调用 Tool Calling'>
          <Tag color='blue' size='small'>
            <Icon icon={Wrench} size={12} />
          </Tag>
        </Tooltip>
      ) : null}
      {abilities?.reasoning ? (
        <Tooltip title='支持推理能力'>
          <Tag color='purple' size='small'>
            <Icon icon={Lightbulb} size={12} />
          </Tag>
        </Tooltip>
      ) : null}
      {abilities?.vision ? (
        <Tooltip title='支持视觉输入'>
          <Tag color='geekblue' size='small'>
            <Icon icon={Eye} size={12} />
          </Tag>
        </Tooltip>
      ) : null}
      {typeof tokens === 'number' ? (
        <Tooltip title={`上下文窗口 ${tokens.toLocaleString('en-US')} Tokens`}>
          <Tag size='small'>{formatTokenNumber(tokens)}</Tag>
        </Tooltip>
      ) : null}
    </Flexbox>
  )
}

ModelItem.displayName = 'ProviderModelItem'

export default ModelItem
