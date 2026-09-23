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
        {title && <Text className='text-[28px] font-bold leading-[1.4]'>{title}</Text>}
        {subtitle && (
          <Text className='text-[18px] font-medium leading-[1.4]' type='secondary'>
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
