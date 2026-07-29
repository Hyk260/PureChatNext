import { Flex, Divider } from 'antd'
import { Text } from '@pure/ui'
import { type ReactNode } from 'react'

interface SettingHeaderProps {
  extra?: ReactNode
  title: ReactNode
}

export function SettingHeader({ extra, title }: SettingHeaderProps) {
  return (
    <Flex vertical gap={24} style={{ paddingTop: 12 }}>
      <Flex align='center' justify='space-between'>
        <Text strong style={{ fontSize: 24 }}>
          {title}
        </Text>
        {extra}
      </Flex>
      <Divider style={{ margin: 0 }} />
    </Flex>
  )
}
