/* eslint-disable react/display-name */
'use client'

import { Text, Flexbox } from '@pure/ui'
import type { FlexboxProps } from '@pure/ui'
import { memo } from 'react'
import type { ReactNode } from 'react'

export interface AuthCardProps extends Omit<FlexboxProps, 'title'> {
  footer?: ReactNode
  subtitle?: ReactNode
  title?: ReactNode
}

export const AuthCard = memo<AuthCardProps>(({ children, title, subtitle, footer, style, ...rest }) => {
  return (
    <Flexbox {...rest} style={{ width: 'min(100%,440px)', ...style }}>
      <Flexbox gap={16}>
        {title && <Text style={{ fontSize: 28, lineHeight: 1.4, fontWeight: 'bold' }}>{title}</Text>}
        {subtitle && (
          <Text type={'secondary'} style={{ fontSize: 18, lineHeight: 1.4, fontWeight: 500 }}>
            {subtitle}
          </Text>
        )}
      </Flexbox>
      <Flexbox gap={12} style={{ paddingBlock: '32px' }}>
        {children}
      </Flexbox>
      {footer}
    </Flexbox>
  )
})

export default AuthCard
