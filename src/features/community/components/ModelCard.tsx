'use client'

import { Flex } from 'antd'
import { Block, Icon, ModelIcon, ProviderIcon, Text } from '@pure/ui'
import { formatDate } from '@pure/utils/client'
import { createStaticStyles, cssVar } from 'antd-style'
import { ClockIcon } from 'lucide-react'
import { memo } from 'react'

import ModelFeatureTags from '@/features/community/components/ModelFeatureTags'
import ModelTypeIcon from '@/features/community/components/ModelTypeIcon'
import { type DiscoverModelItem } from '@/features/community/types'

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
  ({
    abilities,
    contextWindowTokens,
    description,
    displayName,
    identifier,
    providers,
    releasedAt,
    type,
  }) => {
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
        <Flex align='flex-start' gap={16} justify='space-between' style={{ padding: 16, width: '100%' }}>
          <Flex gap={12} title={identifier} style={{ overflow: 'hidden' }}>
            <ModelIcon model={identifier} size={40} style={{ flex: 'none' }} type='avatar' />
            <Flex vertical flex={1} gap={2} style={{ overflow: 'hidden' }}>
              <Text ellipsis className={styles.title}>
                {displayName}
              </Text>
              <div className={styles.author}>{identifier}</div>
            </Flex>
          </Flex>
          <ModelTypeIcon type={type} />
        </Flex>
        <Flex vertical flex={1} gap={12} style={{ paddingInline: 16 }}>
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
        </Flex>
        <Flex align='center' className={styles.footer} justify='space-between' style={{ padding: 16 }}>
          <Flex align='center' className={styles.secondaryDesc} gap={4}>
            {releasedAt ? (
              <>
                <Icon icon={ClockIcon} size={14} />
                <span>
                  {formatDate(releasedAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </>
            ) : null}
          </Flex>
          <Flex align='center' gap={6}>
            {providers.slice(0, 6).map((item) => (
              <ProviderIcon key={item} provider={item} size={14} type='mono' />
            ))}
          </Flex>
        </Flex>
      </Block>
    )
  }
)

ModelCard.displayName = 'ModelCard'

export default ModelCard
