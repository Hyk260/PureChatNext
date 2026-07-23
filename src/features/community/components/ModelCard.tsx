'use client'

import { Flex, Typography } from 'antd'
import { Block, ModelIcon, ProviderIcon } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo } from 'react'

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
  title: css`
    margin: 0 !important;
    font-size: 16px !important;
    font-weight: 500 !important;
  `,
}))

const ModelCard = memo<DiscoverModelItem>(
  ({ description, displayName, identifier, providers }) => {
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
          <Flex gap={12} title={identifier} style={{ overflow: 'hidden', }}>
            <ModelIcon model={identifier} size={40} style={{ flex: 'none' }} type='avatar' />
            <Flex vertical flex={1} gap={2} style={{ overflow: 'hidden', }}>
              <Typography.Text ellipsis className={styles.title}>
                {displayName}
              </Typography.Text>
              <div className={styles.author}>{identifier}</div>
            </Flex>
          </Flex>
        </Flex>
        <Flex vertical flex={1} gap={12} style={{ paddingInline: 16 }}>
          {description ? (
            <Typography.Paragraph className={styles.desc} ellipsis={{
                rows: 3,
              }} style={{ marginBottom: 0 }}>
              {description}
            </Typography.Paragraph>
          ) : null}
        </Flex>
        <Flex align='center' className={styles.footer} justify='space-between' style={{ padding: 16 }}>
          <Flex align='center' gap={6}>
            {providers.slice(0, 6).map((item) => (
              <ProviderIcon key={item} provider={item} size={14} type='mono' />
            ))}
          </Flex>
        </Flex>
      </Block>
    )
  },
)

ModelCard.displayName = 'ModelCard'

export default ModelCard
