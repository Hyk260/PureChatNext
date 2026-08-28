'use client'

import { ActionIcon, Flex } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { PanelLeftOpen } from 'lucide-react'
import { usePathname } from '@/utils/navigation'
import { memo, useMemo } from 'react'

import { useHomeStore } from '@/features/home/store/useHomeStore'

import AgentSearch from './components/AgentSearch'

const styles = createStaticStyles(({ css }) => ({
  header: css`
    flex: none;
    height: 40px;
    padding-inline: 8px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};
  `,
}))

const useSearchPlaceholder = () => {
  const pathname = usePathname()

  return useMemo(() => {
    if (pathname.startsWith('/community/model')) return '搜索名称介绍或关键词'
    if (pathname.startsWith('/community/agent')) return '搜索名称、描述或关键词'
    return null
  }, [pathname])
}

const CommunityHeader = memo(() => {
  const placeholder = useSearchPlaceholder()
  const sidebarCollapsed = useHomeStore((s) => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useHomeStore((s) => s.toggleSidebarCollapsed)

  return (
    <Flex className={[styles.header, 'flex-row items-center gap-2']}>
      {sidebarCollapsed ? (
        <ActionIcon icon={PanelLeftOpen} size='small' title='展开侧栏' onClick={toggleSidebarCollapsed} />
      ) : null}
      {placeholder ? (
        <Flex className={'flex-col flex-1 w-full'}>
          <AgentSearch placeholder={placeholder} />
        </Flex>
      ) : null}
    </Flex>
  )
})

CommunityHeader.displayName = 'CommunityHeader'

export default CommunityHeader
