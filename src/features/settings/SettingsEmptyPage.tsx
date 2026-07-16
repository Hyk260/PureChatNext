'use client'

import { Flexbox, Text } from '@lobehub/ui'
import { Divider } from 'antd'

import { SettingHeader } from '@/features/settings/profile/components/SettingHeader'

interface SettingsEmptyPageProps {
  description?: string
  title: string
}

export function SettingsEmptyPage({
  description = '该设置项暂未开放，敬请期待。',
  title,
}: SettingsEmptyPageProps) {
  return (
    <Flexbox gap={24} style={{ paddingBlock: '24px 64px', paddingInline: 24 }} width="100%">
      <SettingHeader title={title} />
      {/* <Divider style={{ margin: 0 }} /> */}
      <Text type="secondary">{description}</Text>
    </Flexbox>
  )
}
