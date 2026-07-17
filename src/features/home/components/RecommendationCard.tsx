'use client'

import { Github } from '@lobehub/icons'
import { Block, Button, Flexbox, Tag, Text } from '@lobehub/ui'
import { App, Divider } from 'antd'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import { memo, useCallback, useState } from 'react'

import type { HomeRecommendationItem } from '@/const/home/recommendations'

const styles = createStaticStyles(({ css }) => ({
  actionBtnPrimary: css`
    &.ant-btn {
      width: auto !important;
      padding-inline: 12px !important;
    }
  `,
  card: css`
    border-radius: ${cssVar.borderRadiusLG};

    &:hover {
      border-color: ${cssVar.colorBorder} !important;
    }
  `,
  description: css`
    color: ${cssVar.colorTextSecondary};
  `,
}))

interface RecommendationCardProps {
  item: HomeRecommendationItem
}

const RecommendationCard = memo<RecommendationCardProps>(({ item }) => {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)

  const handleClick = useCallback(async () => {
    if (loading) return
    setLoading(true)
    try {
      message.info('任务模板功能即将推出')
    } finally {
      setLoading(false)
    }
  }, [loading, message])

  return (
    <Block className={styles.card} gap={12} padding={12} variant='outlined'>
      <Flexbox horizontal align='center' gap={8} style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <Github size={18} type='mono' />
        <Text ellipsis fontSize={16} weight={500}>
          {item.title}
        </Text>
      </Flexbox>
      <Divider dashed style={{ marginBlock: 0 }} />
      <Text className={styles.description} fontSize={13}>
        {item.description}
      </Text>
      <Flexbox horizontal align='center' gap={8} justify='space-between' wrap='wrap'>
        <Tag size='small' variant='outlined'>
          {item.tag}
        </Tag>
        <Button
          className={cx(styles.actionBtnPrimary)}
          loading={loading}
          shadow
          shape='round'
          onClick={() => handleClick()}
        >
          添加任务
        </Button>
      </Flexbox>
    </Block>
  )
})

RecommendationCard.displayName = 'RecommendationCard'

export default RecommendationCard
