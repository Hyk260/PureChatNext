'use client'

import { Flexbox } from '@pure/ui'
import { Skeleton } from 'antd'
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
  <Flexbox className={styles.root} gap={20}>
    <Skeleton active className={styles.row} paragraph={{ rows: 3 }} title={{ width: '30%' }} />
    <Skeleton active className={styles.row} paragraph={{ rows: 5 }} title={{ width: '40%' }} />
    <Skeleton active className={styles.row} paragraph={{ rows: 2 }} title={false} />
  </Flexbox>
))

ChatMessagesSkeleton.displayName = 'ChatMessagesSkeleton'

export default ChatMessagesSkeleton
