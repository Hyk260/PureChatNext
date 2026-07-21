import { Flexbox, Text } from '@lobehub/ui'
import { Divider } from 'antd'
import { type ReactNode } from 'react'

interface SettingHeaderProps {
  extra?: ReactNode
  title: ReactNode
}

export function SettingHeader({ extra, title }: SettingHeaderProps) {
  return (
    <Flexbox gap={24} style={{ paddingTop: 12 }}>
      <Flexbox align="center" horizontal justify="space-between">
        <Text fontSize={24} strong>
          {title}
        </Text>
        {extra}
      </Flexbox>
      <Divider style={{ margin: 0 }} />
    </Flexbox>
  )
}
