'use client'

import { getAiModel } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'
import { Flex, ModelIcon } from '@pure/ui'
import type { ChatMessageMetadata } from '@pure/types'
import { Button, Icon, Popover, Text, Tooltip, cssVar } from '@lobehub/ui'
import { CircleHelpIcon, CoinsIcon } from 'lucide-react'
import { memo } from 'react'

import { getMessageUsageDetails } from '@/features/chat/usageDetails'
import type { UsageDetailItem } from '@/features/chat/usageDetails'
import { useChatUiStore } from '@/features/chat/store/useChatUiStore'

const tokenFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const summaryClassName = 'min-w-0 flex-1 flex-between gap-4 text-xs'
const detailRowClassName = 'min-h-6 flex-between gap-5 text-[13px]'
const detailLabelClassName = 'inline-flex items-center gap-1.5'
const detailValueClassName = 'tabular-nums font-medium'

const getModelCard = (provider: string | undefined, model: string | undefined) => {
  if (!provider || !model) return undefined
  return getAiModel(provider as ModelProviderId, model)
}

const SegmentedProgress = memo<{ items: UsageDetailItem[] }>(({ items }) => {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  if (total <= 0) return null

  return (
    <Flex
      aria-hidden='true'
      className='h-[6px] w-full overflow-hidden rounded-full'
      style={{ backgroundColor: cssVar.colorFillSecondary }}
    >
      {items.map((item) => (
        <Flex
          key={item.key}
          className='h-full shrink-0'
          style={{ backgroundColor: item.color, width: `${(item.value / total) * 100}%` }}
        />
      ))}
    </Flex>
  )
})

SegmentedProgress.displayName = 'SegmentedProgress'

const DetailRows = memo<{ items: UsageDetailItem[] }>(({ items }) => (
  <>
    {items.map((item) => (
      <Flex className={detailRowClassName} key={item.key}>
        <Text
          as='span'
          className={detailLabelClassName}
          color={cssVar.colorTextSecondary}
          fontSize={13}
        >
          <span aria-hidden='true' className='size-[7px] shrink-0 rounded-full' style={{ background: item.color }} />
          {item.label}
        </Text>
        <Text as='span' className={detailValueClassName} color={cssVar.colorText} fontSize={13}>
          {tokenFormatter.format(item.value)}
        </Text>
      </Flex>
    ))}
  </>
))

DetailRows.displayName = 'DetailRows'

const PerformanceLabel = memo<{ label: string; tooltip: string; value: string }>(({ label, tooltip, value }) => (
  <Flex className={detailRowClassName}>
    <Text
      as='span'
      className={detailLabelClassName}
      color={cssVar.colorTextSecondary}
      fontSize={13}
    >
      {label}
      <Tooltip title={tooltip}>
        <Icon color={cssVar.colorTextQuaternary} icon={CircleHelpIcon} size={13} />
      </Tooltip>
    </Text>
    <Text as='span' className={detailValueClassName} color={cssVar.colorText} fontSize={13}>
      {value}
    </Text>
  </Flex>
))

PerformanceLabel.displayName = 'PerformanceLabel'

interface MessageUsageProps {
  isStreaming?: boolean
  metadata?: ChatMessageMetadata
}

const MessageUsage = memo<MessageUsageProps>(({ isStreaming = false, metadata }) => {
  const showMessageUsage = useChatUiStore((state) => state.showMessageUsage)

  if (!showMessageUsage) return null

  if (isStreaming) {
    return (
      <Flex
        aria-hidden='true'
        className={summaryClassName}
        style={{ color: cssVar.colorTextQuaternary }}
      >
        <Flex className='min-w-0 items-center gap-1'>
          <Text as='span' className='invisible h-3.5 w-[120px]' />
        </Flex>
      </Flex>
    )
  }

  if (!metadata) return null

  const { model, performance, provider } = metadata
  const details = getMessageUsageDetails(metadata)
  const modelCard = getModelCard(provider, model)
  const tps = performance?.tps && performance.tps > 0 ? performance.tps : undefined
  const ttft = performance?.ttft && performance.ttft > 0 ? performance.ttft : undefined
  const hasDetail = Boolean(details.totalTokens || tps || ttft)

  if (!model && !hasDetail) return null

  const detailContent = (
    <Flex className='min-w-[240px] flex-col gap-2'>
      <Text className='text-[13px] font-medium' color={cssVar.colorTextDescription} fontSize={13}>
        输出明细
      </Text>

      {details.output.length > 0 ? (
        <Flex className='flex-col gap-1'>
          <SegmentedProgress items={details.output} />
          <DetailRows items={details.output} />
        </Flex>
      ) : null}

      {details.input.length > 0 ? (
        <Flex className='flex-col gap-1'>
          <SegmentedProgress items={details.input} />
          <DetailRows items={details.input} />
        </Flex>
      ) : null}

      {hasDetail ? (
        <Flex className='my-2 h-px' style={{ backgroundColor: cssVar.colorBorderSecondary }} />
      ) : null}
      {details.totalTokens ? (
        <Flex className={detailRowClassName}>
          <Text as='span' color={cssVar.colorTextSecondary} fontSize={13}>
            总消耗
          </Text>
          <Text as='span' className={detailValueClassName} color={cssVar.colorText} fontSize={13}>
            {tokenFormatter.format(details.totalTokens)}
          </Text>
        </Flex>
      ) : null}
      {tps ? (
        <PerformanceLabel label='TPS' tooltip='模型开始输出后每秒生成的 Token 数量' value={tps.toFixed(2)} />
      ) : null}
      {ttft ? (
        <PerformanceLabel
          label='TTFT'
          tooltip='从发送请求到收到首个输出内容的耗时'
          value={`${(ttft / 1000).toFixed(2)}s`}
        />
      ) : null}
    </Flex>
  )

  return (
    <Flex
      className={summaryClassName}
      style={{ color: cssVar.colorTextQuaternary }}
    >
      <Flex className='min-w-0 items-center gap-1'>
        {model ? <ModelIcon model={model} size={14} type='mono' /> : null}
        {model ? (
          <Text as='span' className='truncate' color={cssVar.colorTextQuaternary} fontSize={12}>
            {modelCard?.displayName || model}
          </Text>
        ) : null}
        {model && tps ? <Text as='span' color={cssVar.colorTextQuaternary} fontSize={12}>·</Text> : null}
        {tps ? <Text as='span' color={cssVar.colorTextQuaternary} fontSize={12}>{tps.toFixed(1)} TPS</Text> : null}
      </Flex>

      {details.totalTokens ? (
        <Popover content={detailContent} placement='topRight' trigger='hover'>
          <Button
            aria-label='查看输出明细'
            className='h-auto gap-[3px] p-0 text-inherit'
            size='small'
            style={{ color: cssVar.colorTextQuaternary }}
            type='text'
          >
            <Icon aria-hidden='true' icon={CoinsIcon} size={14} />
            {tokenFormatter.format(details.totalTokens)}
          </Button>
        </Popover>
      ) : null}
    </Flex>
  )
})

MessageUsage.displayName = 'MessageUsage'

export default MessageUsage
