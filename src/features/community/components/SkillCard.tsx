'use client'

import { ActionIcon, Avatar, Block, Flex, Icon, stopPropagation, Tag, Text } from '@pure/ui'
import { Github } from '@pure/ui/icons'
import { formatDate } from '@pure/utils/client'
import { createStaticStyles, cssVar } from 'antd-style'
import { ClockIcon, FileTextIcon, StarIcon } from 'lucide-react'
import { memo, useCallback } from 'react'

import { githubAssetAvatar } from '@/const/community/githubAssetUrl'
import { SKILL_CATEGORY_LABELS } from '@/const/community/skills'
import type { DiscoverSkillItem } from '@/features/community/types'

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
  const {
    author,
    category,
    description,
    github,
    icon,
    identifier,
    name,
    resourcesCount,
    updatedAt,
  } = item

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
            <Text className={styles.title} ellipsis>
              {name}
            </Text>
            <span className={styles.secondaryDesc}>{author}</span>
          </Flex>
        </Flex>
        {github?.url ? (
          <a href={github.url} rel='noopener noreferrer' target='_blank' onClick={stopPropagation}>
            <ActionIcon fill={cssVar.colorTextDescription} icon={Github} title='仓库' />
          </a>
        ) : null}
      </Flex>

      <Flex className='flex-col flex-1 gap-3 px-4'>
        <Text
          as='p'
          className={styles.desc}
          ellipsis={{ rows: 3 }}
          style={{ marginBottom: 0 }}
        >
          {description}
        </Text>
        <Flex className='items-center justify-between'>
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

      <Flex className={[styles.footer, 'flex-between p-4']}>
        <Flex className={[styles.secondaryDesc, 'items-center gap-1']}>
          <Icon icon={ClockIcon} size={14} />
          <span>{formatDate(updatedAt, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </Flex>
        <Flex className={[styles.secondaryDesc, 'items-center gap-1']}>
          <Icon icon={StarIcon} size={14} />
          <span>{formatCompactNumber(github?.stars)}</span>
        </Flex>
      </Flex>
    </Block>
  )
})

SkillCard.displayName = 'SkillCard'

export default SkillCard
