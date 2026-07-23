'use client'

import { Flex } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { type ReactNode } from 'react'

import Scrollbar from '@/components/Scrollbar'

const styles = createStaticStyles(({ css }) => ({
  main: css`
    position: relative;
    min-width: 0;
    background: ${cssVar.colorBgContainer};
  `,
  shell: css`
    height: 100vh;
    overflow: hidden;
  `,
}))

interface MainShellLayoutProps {
  children: ReactNode
  header?: ReactNode
  sidebar: ReactNode
}

const MainShellLayout = ({ children, header, sidebar }: MainShellLayoutProps) => {
  return (
    <Flex className={styles.shell} style={{ height: '100%', width: '100%' }}>
      {sidebar}
      <Flex vertical className={styles.main} flex={1} style={{ height: '100%', minHeight: 0 }}>
        {header}
        <Scrollbar style={{ flex: 1, minHeight: 0, width: '100%' }}>
          {children}
        </Scrollbar>
      </Flex>
    </Flex>
  )
}

export default MainShellLayout
