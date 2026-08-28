'use client'

import { createStaticStyles, cssVar } from 'antd-style'
import { Flex } from '@pure/ui'
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
    <Flex className={[styles.shell, 'flex-row h-full w-full']}>
      {sidebar}
      <Flex className={[styles.main, 'flex-col flex-1 h-full min-h-[0px]']}>
        {header}
        {scrollable ? (
          <Scrollbar style={{ flex: 1, minHeight: 0, width: '100%' }}>{children}</Scrollbar>
        ) : (
          <Flex className='flex-col flex-1 min-h-[0px] overflow-hidden w-full'>{children}</Flex>
        )}
      </Flex>
    </Flex>
  )
}

export default MainShellLayout
