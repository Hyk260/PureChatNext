'use client'

import { Block, Github } from '@pure/ui'
import { Flex, Typography, Button, Divider, Tag } from 'antd'
import { useApp } from '@/components/AntdStaticMethods'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import { memo, useCallback, useState } from 'react'

import { type HomeRecommendationItem } from '@/const/home/recommendations'

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
  const { message } = useApp()
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
      <Flex align='center' gap={8} style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <Github size={18} type='mono' />
        <Typography.Text ellipsis style={{ fontSize: 16, fontWeight: 500 }}>
          {item.title}
        </Typography.Text>
      </Flex>
      <Divider dashed style={{ marginBlock: 0 }} />
      <Typography.Text className={styles.description} style={{ fontSize: 13 }}>
        {item.description}
      </Typography.Text>
      <Flex align='center' gap={8} justify='space-between' wrap='wrap'>
        <Tag bordered style={{ fontSize: 12 }}>
          {item.tag}
        </Tag>
        <Button
          className={cx(styles.actionBtnPrimary)}
          loading={loading}
          shape='round'
          onClick={handleClick}
        >
          添加任务
        </Button>
      </Flex>
    </Block>
  )
})

RecommendationCard.displayName = 'RecommendationCard'

export default RecommendationCard
