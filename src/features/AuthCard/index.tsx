/* eslint-disable react/display-name */
'use client'

import { Flex, type FlexProps } from 'antd'
import { Text } from '@pure/ui'
import { type ReactNode, memo } from 'react'

export interface AuthCardProps extends Omit<FlexProps, 'title'> {
  footer?: ReactNode
  subtitle?: ReactNode
  title?: ReactNode
}

export const AuthCard = memo<AuthCardProps>(({ children, title, subtitle, footer, style, ...rest }) => {
  return (
    <Flex vertical {...rest} style={{ width: 'min(100%,440px)', ...style }}>
      <Flex vertical gap={16}>
        {title && (
          <Text style={{ fontSize: 28, lineHeight: 1.4, fontWeight: 'bold' }}>{title}</Text>
        )}
        {subtitle && (
          <Text type={'secondary'} style={{ fontSize: 18, lineHeight: 1.4, fontWeight: 500 }}>
            {subtitle}
          </Text>
        )}
      </Flex>
      <Flex vertical gap={12} style={{ paddingBlock: '32px' }}>
        {children}
      </Flex>
      {footer}
    </Flex>
  )
})

export default AuthCard
