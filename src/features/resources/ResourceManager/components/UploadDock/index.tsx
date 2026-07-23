'use client'

import { Flex, Typography } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo, useState } from 'react'

const styles = createStaticStyles(({ css }) => ({
  dock: css`
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 100;
    min-width: 240px;
    padding: 12px 16px;
    background: ${cssVar.colorBgElevated};
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};
    box-shadow: ${cssVar.boxShadowSecondary};
  `,
}))

interface UploadItem {
  id: string
  name: string
  progress: number
}

const UploadDock = memo(() => {
  const [items] = useState<UploadItem[]>([])

  if (items.length === 0) return null

  return (
    <Flex vertical className={styles.dock} gap={8}>
      <Typography.Text strong>上传中</Typography.Text>
      {items.map((item) => (
        <Typography.Text key={item.id} style={{ fontSize: 12 }}>
          {item.name} — {item.progress}%
        </Typography.Text>
      ))}
    </Flex>
  )
})

UploadDock.displayName = 'UploadDock'

export default UploadDock

export const pushUploadItem = (_item: UploadItem) => {
  // MVP placeholder for upload progress tracking
}
