import type { ReactNode } from 'react'
import type { ResultProps } from 'antd'

import { Button, Flex } from '@pure/ui'
import { Result } from 'antd'

import Link from 'next/link'
import { getDesktopApi } from '@/types/desktop'

export const StatusHomeButton = () => (
  <Link href='/'>
    <Button type='primary'>返回首页</Button>
  </Link>
)

export const StatusPage = (props: ResultProps) => (
  <Flex className={`${getDesktopApi() ? 'min-h-full shrink-0' : 'min-h-svh'} w-full flex-center bg-background`}>
    <Result {...props} />
  </Flex>
)

export const StatusActions = ({ children }: { children: ReactNode }) => (
  <Flex className='justify-center gap-3'>{children}</Flex>
)
