import { Flex, Typography, Divider } from 'antd'
import { type ReactNode } from 'react'

interface SettingHeaderProps {
  extra?: ReactNode
  title: ReactNode
}

export function SettingHeader({ extra, title }: SettingHeaderProps) {
  return (
    <Flex vertical gap={24} style={{ paddingTop: 12 }}>
      <Flex align="center" justify="space-between">
        <Typography.Text strong style={{ fontSize: 24 }}>
          {title}
        </Typography.Text>
        {extra}
      </Flex>
      <Divider style={{ margin: 0 }} />
    </Flex>
  )
}
