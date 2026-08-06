'use client'

import { Text, Flexbox } from '@pure/ui'

interface SettingsEmptyPageProps {
  description?: string
}

export function SettingsEmptyPage({ description = '该设置项暂未开放，敬请期待。' }: SettingsEmptyPageProps) {
  return (
    <Flexbox gap={24} style={{ paddingBlock: '24px 64px', paddingInline: 24, width: '100%' }}>
      <Text type='secondary'>{description}</Text>
    </Flexbox>
  )
}
