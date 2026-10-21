'use client'

import { Block, MaskShadow, ModelTag, ProviderCombine, ActionIcon, Text, Flex } from '@pure/ui'
import { createStaticStyles, cssVar, cx } from '@lobehub/ui'
import { GlobeIcon } from 'lucide-react'
import { memo } from 'react'

import type { DiscoverProviderItem } from '@/features/community/types'

const styles = createStaticStyles(({ css }) => ({
  // 保留 createStaticStyles：依赖尚无对应 Tailwind 语义 token 的主题或运行时变量。
  author: css`
    color: ${cssVar.colorTextDescription};
  `,
  // 保留 createStaticStyles：依赖尚无对应 Tailwind 语义 token 的主题或运行时变量。
  desc: css`
    color: ${cssVar.colorTextSecondary};
  `,
  // 保留 createStaticStyles：依赖尚无对应 Tailwind 语义 token 的主题或运行时变量。
  footer: css`
    border-block-start: 1px dashed ${cssVar.colorBorder};
  `,
}))

const ProviderCard = memo<DiscoverProviderItem>(({ url, name, description, identifier, models }) => {
  return (
    <Block
      data-testid='provider-item'
      className='flex flex-col'
      height='100%'
      variant='outlined'
      width='100%'
      style={{
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Flex className='items-start gap-4 justify-between p-4 w-full'>
        <Flex className='flex-col overflow-hidden' title={identifier}>
          <ProviderCombine provider={identifier} size={28} style={{ flex: 'none' }} />
          <div className={styles.author}>@{name}</div>
        </Flex>
        <Flex className='items-center'>
          <a href={url} rel='noopener noreferrer' target='_blank' onClick={(event) => event.stopPropagation()}>
            <ActionIcon color={cssVar.colorTextDescription} icon={GlobeIcon} />
          </a>
        </Flex>
      </Flex>
      <Flex className='flex-col flex-1 gap-3 px-4'>
        {description ? (
          <Text
            as='p'
            className={cx(styles.desc, 'flex-none !m-0')}
            ellipsis={{
              rows: 3,
            }}
          >
            {description}
          </Text>
        ) : null}
      </Flex>
      <Flex className={[cx(styles.footer, 'mt-4 bg-app-surface'), 'flex-between p-4']}>
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
})

ProviderCard.displayName = 'ProviderCard'

export default ProviderCard
