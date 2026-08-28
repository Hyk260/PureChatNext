/* eslint-disable react/display-name */
'use client'

import { Text, Flex } from '@pure/ui'
import type { FlexProps } from '@pure/ui'
import { memo } from 'react'
import type { ReactNode } from 'react'

export interface AuthCardProps extends Omit<FlexProps, 'title'> {
  footer?: ReactNode
  subtitle?: ReactNode
  title?: ReactNode
}

export const AuthCard = memo<AuthCardProps>(({ children, title, subtitle, footer, style, ...rest }) => {
  return (
    <Flex className='flex-col w-[min(100%,440px)]' {...rest} style={{ ...style }}>
      <Flex className='flex-col gap-4'>
        {title && <Text style={{ fontSize: 28, lineHeight: 1.4, fontWeight: 'bold' }}>{title}</Text>}
        {subtitle && (
          <Text type={'secondary'} style={{ fontSize: 18, lineHeight: 1.4, fontWeight: 500 }}>
            {subtitle}
          </Text>
        )}
      </Flex>
      <Flex className='flex-col gap-3 py-8'>{children}</Flex>
      {footer}
    </Flex>
  )
})

export default AuthCard
