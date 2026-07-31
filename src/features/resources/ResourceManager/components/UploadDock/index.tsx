'use client'

import { Text, Flexbox } from '@pure/ui'
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
    <Flexbox className={styles.dock} gap={8}>
      <Text strong>上传中</Text>
      {items.map((item) => (
        <Text key={item.id} style={{ fontSize: 12 }}>
          {item.name} — {item.progress}%
        </Text>
      ))}
    </Flexbox>
  )
})

UploadDock.displayName = 'UploadDock'

export default UploadDock

export const pushUploadItem = (_item: UploadItem) => {
  // MVP placeholder for upload progress tracking
}
