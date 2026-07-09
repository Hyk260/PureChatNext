'use client'

import { Flexbox } from '@lobehub/ui'
import { createStaticStyles } from 'antd-style'
import { type ReactNode } from 'react'

const styles = createStaticStyles(({ css }) => ({
  shell: css`
    height: 100vh;
    overflow: hidden;
  `,
}))

const ResourcesShellLayout = ({
  children,
  innerSidebar,
}: {
  children: ReactNode
  innerSidebar?: ReactNode
}) => {
  return (
    <Flexbox className={styles.shell} horizontal height='100%' width='100%'>
      {innerSidebar}
      <Flexbox flex={1} height='100%' style={{ overflow: 'hidden' }}>
        {children}
      </Flexbox>
    </Flexbox>
  )
}

export default ResourcesShellLayout
