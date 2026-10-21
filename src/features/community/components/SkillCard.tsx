'use client'

import { ActionIcon, Avatar, Block, Flex, Icon, Tag, Text } from '@pure/ui'
import { Github } from '@pure/ui/icons'
import { formatDate } from '@pure/utils/client'
import { createStaticStyles, cssVar, cx } from '@lobehub/ui'
import { ClockIcon, FileTextIcon, StarIcon } from 'lucide-react'
import { memo, useCallback } from 'react'

import { githubAssetAvatar } from '@/const/community/githubAssetUrl'
import { SKILL_CATEGORY_LABELS } from '@/const/community/skills'
import type { DiscoverSkillItem } from '@/features/community/types'

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
  // 保留 createStaticStyles：依赖尚无对应 Tailwind 语义 token 的主题或运行时变量。
  secondaryDesc: css`
    color: ${cssVar.colorTextDescription};
  `,
}))

const formatCompactNumber = (num?: number): string => {
  if (!num) return '0'
  if (num < 1000) return num.toString()
  if (num < 1000000) return `${(num / 1000).toFixed(1)}k`
  return `${(num / 1000000).toFixed(1)}M`
}

export interface SkillCardProps extends DiscoverSkillItem {
  onOpenDetail: (identifier: string) => void
}

const SkillCard = memo<SkillCardProps>(({ onOpenDetail, ...item }) => {
  const { author, category, description, github, icon, identifier, name, resourcesCount, updatedAt } = item

  const handleOpenDetail = useCallback(() => {
    onOpenDetail(identifier)
  }, [identifier, onOpenDetail])

  return (
    <Block
      clickable
      className='flex flex-col'
      data-testid='skill-item'
      height='100%'
      variant='outlined'
      width='100%'
      style={{
        overflow: 'hidden',
        position: 'relative',
      }}
      onClick={handleOpenDetail}
    >
      <Flex className='items-start gap-4 justify-between p-4 w-full'>
        <Flex className='gap-3 overflow-hidden' title={identifier}>
          <Avatar
            avatar={githubAssetAvatar(icon, name)}
            background='transparent'
            shape='square'
            size={40}
            style={{ flex: 'none' }}
          />
          <Flex className='flex-col flex-1 gap-0.5 overflow-hidden'>
            <Text className={'!m-0 !text-base !font-medium'} ellipsis>
              {name}
            </Text>
            <span className={cx(styles.secondaryDesc, 'text-xs')}>{author}</span>
          </Flex>
        </Flex>
        {github?.url ? (
          <a href={github.url} rel='noopener noreferrer' target='_blank' onClick={(event) => event.stopPropagation()}>
            <ActionIcon fill={cssVar.colorTextDescription} icon={Github} title='仓库' />
          </a>
        ) : null}
      </Flex>

      <Flex className='flex-col flex-1 gap-3 px-4'>
        <Text as='p' className={cx(styles.desc, 'flex-1 !m-0')} ellipsis={{ rows: 3 }}>
          {description}
        </Text>
        <Flex className='flex-between'>
          <Tag
            size='small'
            style={{
              borderRadius: 4,
              fontSize: 11,
              color: cssVar.colorTextSecondary,
              background: cssVar.colorFillTertiary,
            }}
          >
            <Flex className='items-center gap-1'>
              <Icon icon={FileTextIcon} size={12} />
              {(resourcesCount || 0) + 1}
            </Flex>
          </Tag>
          <Tag
            size='small'
            style={{
              borderRadius: 4,
              fontSize: 11,
              color: cssVar.colorTextSecondary,
              background: cssVar.colorFillTertiary,
            }}
          >
            {SKILL_CATEGORY_LABELS[category]}
          </Tag>
        </Flex>
      </Flex>

      <Flex className={[cx(styles.footer, 'mt-4 bg-app-surface'), 'flex-between p-4']}>
        <Flex className={[cx(styles.secondaryDesc, 'text-xs'), 'items-center gap-1']}>
          <Icon icon={ClockIcon} size={14} />
          <span>{formatDate(updatedAt, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </Flex>
        <Flex className={[cx(styles.secondaryDesc, 'text-xs'), 'items-center gap-1']}>
          <Icon icon={StarIcon} size={14} />
          <span>{formatCompactNumber(github?.stars)}</span>
        </Flex>
      </Flex>
    </Block>
  )
})

SkillCard.displayName = 'SkillCard'

export default SkillCard
