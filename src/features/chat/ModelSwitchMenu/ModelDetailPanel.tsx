'use client'

import { CREDITS_PER_DOLLAR } from '@pure/const'
import { getAiModel } from '@pure/model-bank'
import type { ModelProviderId, ModelTokenPricing } from '@pure/model-bank'
import { Icon, Tag, Text, Flex } from '@pure/ui'
import { formatTokenNumber } from '@pure/utils/client'
import { createStaticStyles, cssVar } from 'antd-style'
import {
  ArrowDownToDot,
  ArrowUpFromDot,
  AtomIcon,
  CircleFadingArrowUp,
  Code2,
  Eye,
  Globe2,
  ImageIcon,
  Wrench,
} from 'lucide-react'
import { memo, useMemo } from 'react'

import { useProviderConfigStore } from '@/features/settings/provider/store/useProviderConfigStore'
import type { ProviderId } from '@/features/settings/provider/types'

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
  let digits = 3
  if (value >= 100) digits = 0
  else if (value >= 10) digits = 1
  return value.toFixed(digits).replace(/\.?0+$/, '')
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
  const configuredModel = useProviderConfigStore((state) =>
    state.configs[provider as ProviderId]?.models.find((model) => model.id === modelId)
  )

  if (!card && !configuredModel) {
    return (
      <div className={styles.container}>
        <Text as='p' className={styles.description} fontSize={12} type='secondary'>
          暂无该模型的详细信息
        </Text>
      </div>
    )
  }

  const description = card?.description?.trim()
  const pricing = card?.pricing
  const abilities = configuredModel?.abilities ?? card?.abilities
  const contextWindowTokens = configuredModel?.contextWindowTokens ?? card?.contextWindowTokens
  const hasAbilities = Boolean(
    abilities?.functionCall ||
    abilities?.vision ||
    abilities?.reasoning ||
    abilities?.structuredOutput ||
    abilities?.webSearch ||
    abilities?.imageGeneration
  )
  const contextLabel =
    typeof contextWindowTokens === 'number' && contextWindowTokens > 0
      ? `${formatTokenNumber(contextWindowTokens)} tokens`
      : null

  return (
    <Flex className={[styles.container, 'flex-col gap-1']}>
      {description ? (
        <Text as='p' className={styles.description} fontSize={12} type='secondary'>
          {description}
        </Text>
      ) : null}

      {contextLabel ? (
        <Flex className={[styles.row, 'flex-between']}>
          <Flex className='flex-row items-center gap-2'>
            <div className={styles.bar} style={{ background: '#1677ff' }} />
            <span className={styles.sectionTitle}>上下文长度</span>
          </Flex>
          <Text fontSize={13} weight={500}>
            {contextLabel}
          </Text>
        </Flex>
      ) : null}

      {hasAbilities ? (
        <Flex className={[styles.row, 'flex-between']}>
          <Flex className='flex-row items-center gap-2'>
            <div className={styles.bar} style={{ background: '#722ed1' }} />
            <span className={styles.sectionTitle}>能力</span>
          </Flex>
          <Flex className='flex-row gap-1'>
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
            {abilities?.webSearch ? (
              <Tag className={styles.tag} color='cyan' size='small'>
                <Icon icon={Globe2} size={12} />
              </Tag>
            ) : null}
            {abilities?.imageGeneration ? (
              <Tag className={styles.tag} color='magenta' size='small'>
                <Icon icon={ImageIcon} size={12} />
              </Tag>
            ) : null}
            {/* {abilities?.structuredOutput ? (
              <Tag className={styles.tag} color='green' size='small'>
                <Icon icon={Code2} size={12} />
              </Tag>
            ) : null} */}
          </Flex>
        </Flex>
      ) : null}

      {pricing ? (
        <Flex className='flex-col gap-0.5'>
          <Flex className={[styles.row, 'flex-between']}>
            <Flex className='flex-row items-center gap-2'>
              <div className={styles.bar} style={{ background: '#fa8c16' }} />
              <span className={styles.sectionTitle}>价格</span>
            </Flex>
            <Text fontSize={11} type='secondary'>
              {priceUnitLabel(pricing.currency)}
            </Text>
          </Flex>
          <Flex className={[styles.row, 'flex-between']}>
            <Flex className='flex-row items-center gap-1.5'>
              <Icon icon={ArrowUpFromDot} size={12} />
              <span>输入</span>
            </Flex>
            <span>{formatPriceValue(pricing, pricing.textInput)}</span>
          </Flex>
          <Flex className={[styles.row, 'flex-between']}>
            <Flex className='flex-row items-center gap-1.5'>
              <Icon icon={ArrowDownToDot} size={12} />
              <span>输出</span>
            </Flex>
            <span>{formatPriceValue(pricing, pricing.textOutput)}</span>
          </Flex>
          {typeof pricing.textInputCacheRead === 'number' ? (
            <Flex className={[styles.row, 'flex-between']}>
              <Flex className='flex-row items-center gap-1.5'>
                <Icon icon={CircleFadingArrowUp} size={12} />
                <span>输入（缓存读取）</span>
              </Flex>
              <span>{formatPriceValue(pricing, pricing.textInputCacheRead)}</span>
            </Flex>
          ) : null}
        </Flex>
      ) : null}
    </Flex>
  )
})

ModelDetailPanel.displayName = 'ModelDetailPanel'

export default ModelDetailPanel
