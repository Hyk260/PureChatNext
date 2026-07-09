'use client'

import { Flexbox } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { type ReactNode } from 'react'

const styles = createStaticStyles(({ css }) => ({
  main: css`
    position: relative;
    overflow: auto;
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
    <Flexbox className={styles.shell} horizontal height='100%' width='100%'>
      {sidebar}
      <Flexbox className={styles.main} flex={1} height='100%'>
        {header}
        <Flexbox flex={1} style={{ overflow: 'auto' }} width='100%'>
          {children}
        </Flexbox>
      </Flexbox>
    </Flexbox>
  )
}

export default MainShellLayout
