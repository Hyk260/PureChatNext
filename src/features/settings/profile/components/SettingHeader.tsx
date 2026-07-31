import { Divider } from 'antd'
import { Text, Flexbox } from '@pure/ui'
import type { ReactNode } from 'react'

interface SettingHeaderProps {
  extra?: ReactNode
  title: ReactNode
}

export function SettingHeader({ extra, title }: SettingHeaderProps) {
  return (
    <Flexbox gap={24} style={{ paddingTop: 12 }}>
      <Flexbox horizontal align='center' justify='space-between'>
        <Text strong style={{ fontSize: 24 }}>
          {title}
        </Text>
        {extra}
      </Flexbox>
      <Divider style={{ margin: 0 }} />
    </Flexbox>
  )
}
