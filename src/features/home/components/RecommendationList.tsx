'use client'

import { Flex, Typography, Button } from 'antd'
import { useApp } from '@/components/AntdStaticMethods'
import { createStaticStyles, cssVar } from 'antd-style'
import { RefreshCw } from 'lucide-react'
import { memo, useCallback, useState } from 'react'

import {
  HOME_RECOMMENDATIONS,
  type HomeRecommendationItem,
} from '@/const/home/recommendations'

import RecommendationCard from './RecommendationCard'

const styles = createStaticStyles(({ css }) => ({
  subtitle: css`
    color: ${cssVar.colorTextDescription};
  `,
}))

const shuffleRecommendations = (items: HomeRecommendationItem[]) => {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }
  return next
}

const RecommendationList = memo(() => {
  const { message } = useApp()
  const [items, setItems] = useState(HOME_RECOMMENDATIONS)

  const handleRefresh = useCallback(() => {
    setItems(shuffleRecommendations(HOME_RECOMMENDATIONS))
    message.success('已换一批推荐')
  }, [message])

  return (
    <Flex vertical gap={12}>
      <Flex align='center' gap={8} justify='space-between'>
        <Typography.Text className={styles.subtitle} style={{ fontSize: 12 }}>
          为你推荐的一些功能
        </Typography.Text>
        <Button icon={<RefreshCw size={12} />} size='small' type='text' onClick={handleRefresh}>
          换一批
        </Button>
      </Flex>

      <Flex vertical gap={8}>
        {items.map((item) => (
          <RecommendationCard key={item.id} item={item} />
        ))}
      </Flex>
    </Flex>
  )
})

RecommendationList.displayName = 'RecommendationList'

export default RecommendationList
