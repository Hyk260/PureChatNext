'use client'

import { Button, Text, Flexbox } from '@pure/ui'
import { useApp } from '@/components/AntdStaticMethods'
import { createStaticStyles, cssVar } from 'antd-style'
import { RefreshCw } from 'lucide-react'
import { memo, useCallback, useState } from 'react'

import { HOME_RECOMMENDATIONS } from '@/const/home/recommendations'
import type { HomeRecommendationItem } from '@/const/home/recommendations'

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
    <Flexbox gap={12}>
      <Flexbox horizontal align='center' gap={8} justify='space-between'>
        <Text className={styles.subtitle} style={{ fontSize: 12 }}>
          为你推荐的一些功能
        </Text>
        <Button icon={<RefreshCw size={12} />} size='small' type='text' onClick={handleRefresh}>
          换一批
        </Button>
      </Flexbox>

      <Flexbox gap={8}>
        {items.map((item) => (
          <RecommendationCard key={item.id} item={item} />
        ))}
      </Flexbox>
    </Flexbox>
  )
})

RecommendationList.displayName = 'RecommendationList'

export default RecommendationList
