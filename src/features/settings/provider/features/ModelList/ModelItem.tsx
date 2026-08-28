'use client'

import { ActionIcon, Flex, Icon, ModelIcon, SortableList, Tag, Text, Tooltip, copyToClipboard } from '@pure/ui'
import { getAiModel } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'
import { formatTokenNumber } from '@pure/utils/client'
import { Switch } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { Check, CircleX, Code2, Eye, Globe2, ImageIcon, Lightbulb, Loader2, Pencil, Trash2, Wrench } from 'lucide-react'
import { memo } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
import { useProviderConfigStore } from '../../store/useProviderConfigStore'
import type { ProviderId, ProviderModelItem } from '../../types'

const styles = createStaticStyles(({ css }) => ({
  container: css`
    position: relative;
    padding-block: 10px;
    padding-inline: 8px;
    border-radius: ${cssVar.borderRadius};
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
    cursor: copy;
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
  onDeleteCustomModel?: (model: ProviderModelItem) => void
  onEditCustomModel?: (model: ProviderModelItem) => void
  provider: ProviderId
  showDragHandle?: boolean
}

const ModelItem = memo<ModelItemProps>(
  ({ model, onDeleteCustomModel, onEditCustomModel, provider, showDragHandle = false }) => {
    const { message } = useApp()
    const toggleModelEnabled = useProviderConfigStore((s) => s.toggleModelEnabled)
    const card = getAiModel(provider as ModelProviderId, model.id)
    const pricing = card?.pricing
    const abilities = model.abilities ?? card?.abilities
    const contextWindowTokens = model.contextWindowTokens ?? card?.contextWindowTokens
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
        {health?.status === 'success' && typeof health.durationMs === 'number'
          ? formatDuration(health.durationMs)
          : null}
      </span>
    )

    return (
      <Flex className={[styles.container, 'flex-between  w-full']}>
        <Flex className={[styles.desc, 'flex-row items-center gap-3']}>
          {showDragHandle ? <SortableList.DragHandle size='small' title='拖动排序' /> : null}
          <ModelIcon model={model.id} size={32} />
          <Flex className={[styles.meta, 'flex-col gap-1']}>
            <Flex className='flex-row items-center gap-2 min-w-[0px]'>
              <Text ellipsis style={{ fontWeight: 500 }}>
                {model.displayName}
              </Text>
              <Tooltip title='点击复制模型 ID'>
                <Tag
                  className={styles.id}
                  onClick={async () => {
                    await copyToClipboard(model.id)
                    message.success('已复制模型 ID')
                  }}
                >
                  {model.id}
                </Tag>
              </Tooltip>
            </Flex>
            {metadata.length > 0 ? <Text className={styles.metadata}>{metadata.join(' · ')}</Text> : null}
          </Flex>
        </Flex>

        <Flex className='shrink-0 flex-row items-center gap-2'>
          <ModelCapabilityTags abilities={abilities} contextWindowTokens={contextWindowTokens} />
          {model.source === 'custom' ? (
            <Flex className='flex-row gap-0.5'>
              {onEditCustomModel ? (
                <ActionIcon
                  icon={Pencil}
                  size='small'
                  title='编辑自定义模型'
                  onClick={() => onEditCustomModel(model)}
                />
              ) : null}
              {onDeleteCustomModel ? (
                <ActionIcon
                  danger
                  icon={Trash2}
                  size='small'
                  title='删除自定义模型'
                  onClick={() => onDeleteCustomModel(model)}
                />
              ) : null}
            </Flex>
          ) : null}
          <Tooltip title={healthLabel}>{healthStatus}</Tooltip>
          <Switch
            aria-label={`${model.enabled ? '停用' : '启用'} ${model.displayName}`}
            checked={model.enabled}
            size='small'
            onChange={(next) => toggleModelEnabled(provider, model.id, next)}
          />
        </Flex>
      </Flex>
    )
  }
)

const formatPrice = (currency: 'CNY' | 'USD', amount: number) => {
  const value = amount
    .toFixed(amount >= 10 ? 1 : 2)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*?)0+$/, '$1')
  return `${currency === 'USD' ? '$' : '¥'}${value}`
}

const formatDuration = (durationMs: number) => `${(durationMs / 1000).toFixed(2)}s`

const ModelCapabilityTags = ({
  abilities,
  contextWindowTokens,
}: {
  abilities?: NonNullable<ReturnType<typeof getAiModel>>['abilities']
  contextWindowTokens?: number
}) => {
  if (
    !abilities?.functionCall &&
    !abilities?.imageGeneration &&
    !abilities?.reasoning &&
    !abilities?.structuredOutput &&
    !abilities?.vision &&
    !abilities?.webSearch &&
    contextWindowTokens == null
  ) {
    return null
  }

  return (
    <Flex className='flex-row gap-[3px]'>
      {abilities?.functionCall ? (
        <Tooltip title='支持工具调用 Tool Calling'>
          <Tag color='blue' size='small'>
            <Icon icon={Wrench} size={12} />
          </Tag>
        </Tooltip>
      ) : null}
      {/* {abilities?.reasoning ? (
        <Tooltip title='支持推理能力'>
          <Tag color='purple' size='small'>
            <Icon icon={Lightbulb} size={12} />
          </Tag>
        </Tooltip>
      ) : null} */}
      {abilities?.vision ? (
        <Tooltip title='支持视觉输入'>
          <Tag color='geekblue' size='small'>
            <Icon icon={Eye} size={12} />
          </Tag>
        </Tooltip>
      ) : null}
      {/* {abilities?.webSearch ? (
        <Tooltip title='支持联网搜索'>
          <Tag color='cyan' size='small'>
            <Icon icon={Globe2} size={12} />
          </Tag>
        </Tooltip>
      ) : null} */}
      {abilities?.imageGeneration ? (
        <Tooltip title='支持图片生成'>
          <Tag color='magenta' size='small'>
            <Icon icon={ImageIcon} size={12} />
          </Tag>
        </Tooltip>
      ) : null}
      {/* {abilities?.structuredOutput ? (
        <Tooltip title='支持结构化输出'>
          <Tag color='green' size='small'>
            <Icon icon={Code2} size={12} />
          </Tag>
        </Tooltip>
      ) : null} */}
      {typeof contextWindowTokens === 'number' && contextWindowTokens > 0 ? (
        <Tooltip title={`上下文窗口 ${contextWindowTokens.toLocaleString('en-US')} Tokens`}>
          <Tag size='small'>{formatTokenNumber(contextWindowTokens)}</Tag>
        </Tooltip>
      ) : null}
    </Flex>
  )
}

ModelItem.displayName = 'ProviderModelItem'

export default ModelItem
