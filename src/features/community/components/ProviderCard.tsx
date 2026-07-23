'use client'

import { Flex, Typography } from 'antd'
import { Block, MaskShadow, ModelTag, ProviderCombine, stopPropagation, ActionIcon } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { GlobeIcon } from 'lucide-react'
import { memo } from 'react'

import { type DiscoverProviderItem } from '@/features/community/types'

const styles = createStaticStyles(({ css }) => ({
  author: css`
    color: ${cssVar.colorTextDescription};
  `,
  desc: css`
    flex: none;
    margin: 0 !important;
    color: ${cssVar.colorTextSecondary};
  `,
  footer: css`
    margin-block-start: 16px;
    border-block-start: 1px dashed ${cssVar.colorBorder};
    background: ${cssVar.colorBgContainer};
  `,
}))

const ProviderCard = memo<DiscoverProviderItem>(
  ({ url, name, description, identifier, models }) => {
    return (
      <Block
        data-testid='provider-item'
        height='100%'
        variant='outlined'
        width='100%'
        style={{
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Flex align='flex-start' gap={16} justify='space-between' style={{ padding: 16, width: '100%' }}>
          <Flex vertical title={identifier} style={{ overflow: 'hidden', }}>
            <ProviderCombine provider={identifier} size={28} style={{ flex: 'none' }} />
            <div className={styles.author}>@{name}</div>
          </Flex>
          <Flex align='center'>
            <a href={url} rel='noopener noreferrer' target='_blank' onClick={stopPropagation}>
              <ActionIcon color={cssVar.colorTextDescription} icon={GlobeIcon} />
            </a>
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
          <MaskShadow horizontal gap={6} position='right' size={10} width='100%'>
            {models
              .slice(0, 6)
              .filter(Boolean)
              .map((tag) => (
                <ModelTag key={tag} model={tag} style={{ margin: 0 }} />
              ))}
          </MaskShadow>
        </Flex>
      </Block>
    )
  },
)

ProviderCard.displayName = 'ProviderCard'

export default ProviderCard
