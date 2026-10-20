'use client'

import { Flex, Skeleton } from '@pure/ui'
import { createStaticStyles } from '@lobehub/ui'
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
    <Skeleton.Text className={styles.row} rows={4} />
    <Skeleton.Text className={styles.row} rows={6} />
    <Skeleton.Text className={styles.row} rows={2} />
  </Flex>
))

ChatMessagesSkeleton.displayName = 'ChatMessagesSkeleton'

export default ChatMessagesSkeleton
