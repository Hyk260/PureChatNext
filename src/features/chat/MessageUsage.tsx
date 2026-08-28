'use client'

import { getAiModel } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'
import { Icon, ModelIcon, Popover, Tooltip, Flex } from '@pure/ui'
import type { ChatMessageMetadata } from '@pure/types'
import { createStaticStyles, cssVar } from 'antd-style'
import { CircleHelpIcon, CoinsIcon } from 'lucide-react'
import { memo } from 'react'

import { getMessageUsageDetails } from '@/features/chat/usageDetails'
import type { UsageDetailItem } from '@/features/chat/usageDetails'

const tokenFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

const styles = createStaticStyles(({ css }) => ({
  detail: css`
    min-width: 240px;
  `,
  detailLabel: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: ${cssVar.colorTextSecondary};
  `,
  detailRow: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    min-height: 24px;
    font-size: 13px;
  `,
  detailTitle: css`
    color: ${cssVar.colorTextDescription};
    font-size: 13px;
    font-weight: 500;
  `,
  divider: css`
    height: 1px;
    margin-block: 8px;
    background: ${cssVar.colorBorderSecondary};
  `,
  dot: css`
    width: 7px;
    height: 7px;
    border-radius: 50%;
  `,
  info: css`
    color: ${cssVar.colorTextQuaternary};
  `,
  left: css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  `,
  placeholder: css`
    width: 120px;
    height: 14px;
    visibility: hidden;
  `,
  progress: css`
    overflow: hidden;
    display: flex;
    width: 100%;
    height: 6px;
    border-radius: 999px;
    background: ${cssVar.colorFillSecondary};
  `,
  section: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
  `,
  summary: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    margin-block-start: 8px;
    color: ${cssVar.colorTextQuaternary};
    font-size: 12px;
  `,
  tokenTrigger: css`
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 0;
    border: 0;
    color: inherit;
    background: transparent;
    font: inherit;

    &:hover,
    &:focus-visible {
      color: ${cssVar.colorTextSecondary};
      outline: none;
    }
  `,
  value: css`
    color: ${cssVar.colorText};
    font-variant-numeric: tabular-nums;
    font-weight: 500;
  `,
}))

const SegmentedProgress = memo<{ items: UsageDetailItem[] }>(({ items }) => {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  if (total <= 0) return null

  return (
    <div className={styles.progress}>
      {items.map((item) => (
        <span key={item.key} style={{ background: item.color, width: `${(item.value / total) * 100}%` }} />
      ))}
    </div>
  )
})

SegmentedProgress.displayName = 'SegmentedProgress'

const DetailRows = memo<{ items: UsageDetailItem[] }>(({ items }) => (
  <>
    {items.map((item) => (
      <div className={styles.detailRow} key={item.key}>
        <span className={styles.detailLabel}>
          <span className={styles.dot} style={{ background: item.color }} />
          {item.label}
        </span>
        <span className={styles.value}>{tokenFormatter.format(item.value)}</span>
      </div>
    ))}
  </>
))

DetailRows.displayName = 'DetailRows'

const PerformanceLabel = memo<{ label: string; tooltip: string; value: string }>(({ label, tooltip, value }) => (
  <div className={styles.detailRow}>
    <span className={styles.detailLabel}>
      {label}
      <Tooltip title={tooltip}>
        <Icon className={styles.info} icon={CircleHelpIcon} size={13} />
      </Tooltip>
    </span>
    <span className={styles.value}>{value}</span>
  </div>
))

PerformanceLabel.displayName = 'PerformanceLabel'

interface MessageUsageProps {
  isStreaming?: boolean
  metadata?: ChatMessageMetadata
}

const MessageUsage = memo<MessageUsageProps>(({ isStreaming = false, metadata }) => {
  if (isStreaming) {
    return (
      <div aria-hidden className={styles.summary}>
        <span className={styles.left}>
          <span className={styles.placeholder} />
        </span>
      </div>
    )
  }

  if (!metadata) return null

  const { model, performance, provider } = metadata
  const details = getMessageUsageDetails(metadata)
  const modelCard = model && provider ? getAiModel(provider as ModelProviderId, model) : undefined
  const tps = performance?.tps && performance.tps > 0 ? performance.tps : undefined
  const ttft = performance?.ttft && performance.ttft > 0 ? performance.ttft : undefined
  const hasDetail = Boolean(details.totalTokens || tps || ttft)

  if (!model && !hasDetail) return null

  const detailContent = (
    <Flex className={[styles.detail, 'flex-col gap-2']}>
      <div className={styles.detailTitle}>输出明细</div>

      {details.output.length > 0 ? (
        <div className={styles.section}>
          <SegmentedProgress items={details.output} />
          <DetailRows items={details.output} />
        </div>
      ) : null}

      {details.input.length > 0 ? (
        <div className={styles.section}>
          <SegmentedProgress items={details.input} />
          <DetailRows items={details.input} />
        </div>
      ) : null}

      {hasDetail ? <div className={styles.divider} /> : null}
      {details.totalTokens ? (
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>总消耗</span>
          <span className={styles.value}>{tokenFormatter.format(details.totalTokens)}</span>
        </div>
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
    <div className={styles.summary}>
      <span className={styles.left}>
        {model ? <ModelIcon model={model} size={14} type='mono' /> : null}
        {model ? <span>{modelCard?.displayName || model}</span> : null}
        {model && tps ? <span>·</span> : null}
        {tps ? <span>{tps.toFixed(1)} TPS</span> : null}
      </span>

      {details.totalTokens ? (
        <Popover content={detailContent} placement='topRight' trigger='hover'>
          <button aria-label='查看输出明细' className={styles.tokenTrigger} type='button'>
            <Icon icon={CoinsIcon} size={14} />
            {tokenFormatter.format(details.totalTokens)}
          </button>
        </Popover>
      ) : null}
    </div>
  )
})

MessageUsage.displayName = 'MessageUsage'

export default MessageUsage
