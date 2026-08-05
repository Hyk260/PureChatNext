'use client'

import { ActionIcon, Flexbox } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { PanelLeftOpen } from 'lucide-react'
import { usePathname } from '@/utils/navigation'
import { memo, useMemo } from 'react'

import { useHomeStore } from '@/features/home/store/useHomeStore'

import AgentSearch from './components/AgentSearch'

const styles = createStaticStyles(({ css }) => ({
  header: css`
    flex: none;
    height: 53px;
    padding-inline: 8px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};
  `,
  search: css`
    width: 100%;
  `,
}))

const useSearchPlaceholder = () => {
  const pathname = usePathname()

  return useMemo(() => {
    if (pathname.startsWith('/community/model')) return '搜索名称介绍或关键词...'
    if (pathname.startsWith('/community/agent')) return '搜索名称、描述或关键词...'
    return null
  }, [pathname])
}

const CommunityHeader = memo(() => {
  const placeholder = useSearchPlaceholder()
  const sidebarCollapsed = useHomeStore((s) => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useHomeStore((s) => s.toggleSidebarCollapsed)

  return (
    <Flexbox horizontal align='center' className={styles.header} gap={8}>
      {sidebarCollapsed ? (
        <ActionIcon icon={PanelLeftOpen} size='small' title='展开侧栏' onClick={toggleSidebarCollapsed} />
      ) : null}
      {placeholder ? (
        <Flexbox className={styles.search} flex={1}>
          <AgentSearch placeholder={placeholder} />
        </Flexbox>
      ) : null}
    </Flexbox>
  )
})

CommunityHeader.displayName = 'CommunityHeader'

export default CommunityHeader
