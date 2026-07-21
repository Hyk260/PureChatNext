'use client'

import { ModelIcon, ProviderIcon } from '@lobehub/icons'
import { Block, Flexbox, Text } from '@lobehub/ui'
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
        <Flexbox
          horizontal
          align='flex-start'
          gap={16}
          justify='space-between'
          padding={16}
          width='100%'
        >
          <Flexbox
            horizontal
            gap={12}
            title={identifier}
            style={{
              overflow: 'hidden',
            }}
          >
            <ModelIcon model={identifier} size={40} style={{ flex: 'none' }} type='avatar' />
            <Flexbox
              flex={1}
              gap={2}
              style={{
                overflow: 'hidden',
              }}
            >
              <Text ellipsis as='h2' className={styles.title}>
                {displayName}
              </Text>
              <div className={styles.author}>{identifier}</div>
            </Flexbox>
          </Flexbox>
        </Flexbox>
        <Flexbox flex={1} gap={12} paddingInline={16}>
          {description ? (
            <Text
              as='p'
              className={styles.desc}
              ellipsis={{
                rows: 3,
              }}
            >
              {description}
            </Text>
          ) : null}
        </Flexbox>
        <Flexbox
          horizontal
          align='center'
          className={styles.footer}
          justify='space-between'
          padding={16}
        >
          <Flexbox horizontal align='center' gap={6}>
            {providers.slice(0, 6).map((item) => (
              <ProviderIcon key={item} provider={item} size={14} type='mono' />
            ))}
          </Flexbox>
        </Flexbox>
      </Block>
    )
  },
)

ModelCard.displayName = 'ModelCard'

export default ModelCard
