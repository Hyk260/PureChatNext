'use client'

import { createStaticStyles } from 'antd-style'
import { Flex } from '@pure/ui'
import type { ReactNode } from 'react'

const styles = createStaticStyles(({ css }) => ({
  shell: css`
    height: 100vh;
    overflow: hidden;
  `,
}))

const ResourcesShellLayout = ({ children, innerSidebar }: { children: ReactNode; innerSidebar?: ReactNode }) => {
  return (
    <Flex className={[styles.shell, 'flex-row h-full w-full']}>
      {innerSidebar}
      <Flex className='flex-col flex-1 h-full overflow-hidden'>{children}</Flex>
    </Flex>
  )
}

export default ResourcesShellLayout
