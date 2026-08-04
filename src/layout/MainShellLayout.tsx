'use client'

import { createStaticStyles, cssVar } from 'antd-style'
import { Flexbox } from '@pure/ui'
import type { ReactNode } from 'react'

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
  /** 是否由外壳提供统一滚动；关闭后由子页面自行管理滚动区域 */
  scrollable?: boolean
  sidebar: ReactNode
}

const MainShellLayout = ({ children, header, scrollable = true, sidebar }: MainShellLayoutProps) => {
  return (
    <Flexbox horizontal className={styles.shell} style={{ height: '100%', width: '100%' }}>
      {sidebar}
      <Flexbox className={styles.main} flex={1} style={{ height: '100%', minHeight: 0 }}>
        {header}
        {scrollable ? (
          <Scrollbar style={{ flex: 1, minHeight: 0, width: '100%' }}>{children}</Scrollbar>
        ) : (
          <Flexbox flex={1} style={{ minHeight: 0, overflow: 'hidden', width: '100%' }}>
            {children}
          </Flexbox>
        )}
      </Flexbox>
    </Flexbox>
  )
}

export default MainShellLayout
