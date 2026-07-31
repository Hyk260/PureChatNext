'use client'

import { CREDITS_PER_DOLLAR } from '@pure/const'
import { getAiModel } from '@pure/model-bank'
import type { ModelProviderId, ModelTokenPricing } from '@pure/model-bank'
import { Icon, Tag, Text, Flexbox } from '@pure/ui'
import { formatTokenNumber } from '@pure/utils/client'
import { createStaticStyles, cssVar } from 'antd-style'
import { ArrowDownToDot, ArrowUpFromDot, AtomIcon, CircleFadingArrowUp, Eye, Wrench } from 'lucide-react'
import { memo, useMemo } from 'react'

const styles = createStaticStyles(({ css }) => ({
  bar: css`
    flex-shrink: 0;
    width: 3px;
    height: 14px;
    border-radius: 2px;
  `,
  container: css`
    padding-block-end: 8px;
  `,
  description: css`
    margin: 0;
    padding-block: 8px;
    padding-inline: 8px;
    line-height: 1.5;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  `,
  row: css`
    padding-block: 4px;
    padding-inline: 8px;
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
  `,
  sectionTitle: css`
    font-size: 14px;
    font-weight: 400;
    color: ${cssVar.colorTextSecondary};
  `,
  tag: css`
    display: inline-flex;
    align-items: center;
    margin: 0 !important;
    padding-inline: 4px !important;
  `,
}))

const trimNumber = (value: number) => {
  const fixed = value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(3)
  return fixed.replace(/\.?0+$/, '')
}

const formatPriceValue = (pricing: ModelTokenPricing, amount: number) => {
  if (pricing.currency === 'USD') {
    const millionsOfCredits = (amount * CREDITS_PER_DOLLAR) / 1_000_000
    return `${trimNumber(millionsOfCredits)}M`
  }
  return `¥${trimNumber(amount)}`
}

const priceUnitLabel = (currency: ModelTokenPricing['currency']) =>
  currency === 'USD' ? '积分/百万令牌' : '元/百万令牌'

export interface ModelDetailPanelProps {
  model: string
  provider: string
}

const ModelDetailPanel = memo<ModelDetailPanelProps>(({ model: modelId, provider }) => {
  const card = useMemo(() => getAiModel(provider as ModelProviderId, modelId), [modelId, provider])

  if (!card) {
    return (
      <div className={styles.container}>
        <Text as='p' className={styles.description} fontSize={12} type='secondary'>
          暂无该模型的详细信息
        </Text>
      </div>
    )
  }

  const description = card.description?.trim()
  const pricing = card.pricing
  const abilities = card.abilities
  const hasAbilities = Boolean(
    abilities?.functionCall || abilities?.vision || abilities?.reasoning || abilities?.structuredOutput
  )
  const contextLabel =
    typeof card.contextWindowTokens === 'number' ? `${formatTokenNumber(card.contextWindowTokens)} tokens` : null

  return (
    <Flexbox className={styles.container} gap={4}>
      {description ? (
        <Text as='p' className={styles.description} fontSize={12} type='secondary'>
          {description}
        </Text>
      ) : null}

      {contextLabel ? (
        <Flexbox horizontal align='center' className={styles.row} justify='space-between'>
          <Flexbox horizontal align='center' gap={8}>
            <div className={styles.bar} style={{ background: '#1677ff' }} />
            <span className={styles.sectionTitle}>上下文长度</span>
          </Flexbox>
          <Text fontSize={13} weight={500}>
            {contextLabel}
          </Text>
        </Flexbox>
      ) : null}

      {hasAbilities ? (
        <Flexbox horizontal align='center' className={styles.row} justify='space-between'>
          <Flexbox horizontal align='center' gap={8}>
            <div className={styles.bar} style={{ background: '#722ed1' }} />
            <span className={styles.sectionTitle}>能力</span>
          </Flexbox>
          <Flexbox horizontal gap={4}>
            {abilities?.functionCall ? (
              <Tag className={styles.tag} color='blue' size='small'>
                <Icon icon={Wrench} size={12} />
              </Tag>
            ) : null}
            {abilities?.vision ? (
              <Tag className={styles.tag} color='geekblue' size='small'>
                <Icon icon={Eye} size={12} />
              </Tag>
            ) : null}
            {abilities?.reasoning ? (
              <Tag className={styles.tag} color='purple' size='small'>
                <Icon icon={AtomIcon} size={12} />
              </Tag>
            ) : null}
            {/* {abilities?.structuredOutput ? (
              <Tag className={styles.tag} color='cyan' size='small' style={{ fontSize: 11 }}>
                JSON
              </Tag>
            ) : null} */}
          </Flexbox>
        </Flexbox>
      ) : null}

      {pricing ? (
        <Flexbox gap={2}>
          <Flexbox horizontal align='center' className={styles.row} justify='space-between'>
            <Flexbox horizontal align='center' gap={8}>
              <div className={styles.bar} style={{ background: '#fa8c16' }} />
              <span className={styles.sectionTitle}>价格</span>
            </Flexbox>
            <Text fontSize={11} type='secondary'>
              {priceUnitLabel(pricing.currency)}
            </Text>
          </Flexbox>
          <Flexbox horizontal align='center' className={styles.row} justify='space-between'>
            <Flexbox horizontal align='center' gap={6}>
              <Icon icon={ArrowUpFromDot} size={12} />
              <span>输入</span>
            </Flexbox>
            <span>{formatPriceValue(pricing, pricing.textInput)}</span>
          </Flexbox>
          <Flexbox horizontal align='center' className={styles.row} justify='space-between'>
            <Flexbox horizontal align='center' gap={6}>
              <Icon icon={ArrowDownToDot} size={12} />
              <span>输出</span>
            </Flexbox>
            <span>{formatPriceValue(pricing, pricing.textOutput)}</span>
          </Flexbox>
          {typeof pricing.textInputCacheRead === 'number' ? (
            <Flexbox horizontal align='center' className={styles.row} justify='space-between'>
              <Flexbox horizontal align='center' gap={6}>
                <Icon icon={CircleFadingArrowUp} size={12} />
                <span>输入（缓存读取）</span>
              </Flexbox>
              <span>{formatPriceValue(pricing, pricing.textInputCacheRead)}</span>
            </Flexbox>
          ) : null}
        </Flexbox>
      ) : null}
    </Flexbox>
  )
})

ModelDetailPanel.displayName = 'ModelDetailPanel'

export default ModelDetailPanel
