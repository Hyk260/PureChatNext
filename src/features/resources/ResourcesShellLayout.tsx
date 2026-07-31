'use client'

import { createStaticStyles } from 'antd-style'
import { Flexbox } from '@pure/ui'
import type { ReactNode } from 'react'

const styles = createStaticStyles(({ css }) => ({
  shell: css`
    height: 100vh;
    overflow: hidden;
  `,
}))

const ResourcesShellLayout = ({ children, innerSidebar }: { children: ReactNode; innerSidebar?: ReactNode }) => {
  return (
    <Flexbox horizontal className={styles.shell} style={{ height: '100%', width: '100%' }}>
      {innerSidebar}
      <Flexbox flex={1} style={{ height: '100%', overflow: 'hidden' }}>
        {children}
      </Flexbox>
    </Flexbox>
  )
}

export default ResourcesShellLayout
