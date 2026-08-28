'use client'

import { Flex, Skeleton } from '@pure/ui'
import { createStaticStyles } from 'antd-style'
import { memo } from 'react'

const styles = createStaticStyles(({ css }) => ({
  root: css`
    overflow: hidden auto;
    flex: 1;
    min-height: 0;
    padding-block: 8px;
  `,
  row: css`
    width: min(100%, 720px);
  `,
}))

/** Message-area placeholder while a topic's history is loading. Keeps ChatInput mounted. */
const ChatMessagesSkeleton = memo(() => (
  <Flex className={[styles.root, 'flex-col gap-5']}>
    <Skeleton active className={styles.row} paragraph={{ rows: 3 }} title={{ width: '30%' }} />
    <Skeleton active className={styles.row} paragraph={{ rows: 5 }} title={{ width: '40%' }} />
    <Skeleton active className={styles.row} paragraph={{ rows: 2 }} title={false} />
  </Flex>
))

ChatMessagesSkeleton.displayName = 'ChatMessagesSkeleton'

export default ChatMessagesSkeleton
