'use client'

import { Block, Icon, ModelIcon, ProviderIcon, Text, Flexbox } from '@pure/ui'
import { formatDate } from '@pure/utils/client'
import { createStaticStyles, cssVar } from 'antd-style'
import { ClockIcon } from 'lucide-react'
import { memo } from 'react'

import ModelFeatureTags from '@/features/community/components/ModelFeatureTags'
import ModelTypeIcon from '@/features/community/components/ModelTypeIcon'
import type { DiscoverModelItem } from '@/features/community/types'

const styles = createStaticStyles(({ css }) => ({
  author: css`
    color: ${cssVar.colorTextDescription};
  `,
  desc: css`
    flex: 1;
    margin: 0 !important;
    color: ${cssVar.colorTextSecondary};
  `,
  footer: css`
    margin-block-start: 16px;
    border-block-start: 1px dashed ${cssVar.colorBorder};
    background: ${cssVar.colorBgContainer};
  `,
  secondaryDesc: css`
    font-size: 12px;
    color: ${cssVar.colorTextDescription};
  `,
  title: css`
    margin: 0 !important;
    font-size: 16px !important;
    font-weight: 500 !important;
  `,
}))

const ModelCard = memo<DiscoverModelItem>(
  ({ abilities, contextWindowTokens, description, displayName, identifier, providers, releasedAt, type }) => {
    return (
      <Block
        data-testid='model-item'
        height='100%'
        variant='outlined'
        width='100%'
        style={{
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Flexbox horizontal align='flex-start' gap={16} justify='space-between' style={{ padding: 16, width: '100%' }}>
          <Flexbox horizontal gap={12} title={identifier} style={{ overflow: 'hidden' }}>
            <ModelIcon model={identifier} size={40} style={{ flex: 'none' }} type='avatar' />
            <Flexbox flex={1} gap={2} style={{ overflow: 'hidden' }}>
              <Text ellipsis className={styles.title}>
                {displayName}
              </Text>
              <div className={styles.author}>{identifier}</div>
            </Flexbox>
          </Flexbox>
          <ModelTypeIcon type={type} />
        </Flexbox>
        <Flexbox flex={1} gap={12} style={{ paddingInline: 16 }}>
          <ModelFeatureTags abilities={abilities} contextWindowTokens={contextWindowTokens} />
          {description ? (
            <Text
              as='p'
              className={styles.desc}
              ellipsis={{
                rows: 3,
              }}
              style={{ marginBottom: 0 }}
            >
              {description}
            </Text>
          ) : null}
        </Flexbox>
        <Flexbox horizontal align='center' className={styles.footer} justify='space-between' style={{ padding: 16 }}>
          <Flexbox horizontal align='center' className={styles.secondaryDesc} gap={4}>
            {releasedAt ? (
              <>
                <Icon icon={ClockIcon} size={14} />
                <span>{formatDate(releasedAt, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </>
            ) : null}
          </Flexbox>
          <Flexbox horizontal align='center' gap={6}>
            {providers.slice(0, 6).map((item) => (
              <ProviderIcon key={item} provider={item} size={14} type='mono' />
            ))}
          </Flexbox>
        </Flexbox>
      </Block>
    )
  }
)

ModelCard.displayName = 'ModelCard'

export default ModelCard
