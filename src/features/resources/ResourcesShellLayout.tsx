'use client'

import { Flex } from 'antd'
import { createStaticStyles } from 'antd-style'
import { type ReactNode } from 'react'

const styles = createStaticStyles(({ css }) => ({
  shell: css`
    height: 100vh;
    overflow: hidden;
  `,
}))

const ResourcesShellLayout = ({ children, innerSidebar }: { children: ReactNode; innerSidebar?: ReactNode }) => {
  return (
    <Flex className={styles.shell} style={{ height: '100%', width: '100%' }}>
      {innerSidebar}
      <Flex vertical flex={1} style={{ height: '100%', overflow: 'hidden' }}>
        {children}
      </Flex>
    </Flex>
  )
}

export default ResourcesShellLayout
