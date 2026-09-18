'use client'

import { ActionIcon, Button, Flex } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { PanelLeftOpen, Plus } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { memo, useMemo, useState } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
import { AssistantCategory } from '@/features/community/types'
import { createAgent } from '@/features/home/agentApi'
import AgentFormModal from '@/features/home/HomeSidebar/modals/AgentFormModal'
import type { AgentFormValues } from '@/features/home/HomeSidebar/modals/AgentFormModal'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
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
    if (pathname.startsWith('/community/skill')) return '搜索技能名称、描述或关键词'
    if (pathname.startsWith('/community/agent')) return '搜索名称、描述或关键词'
    return null
  }, [pathname])
}

const CommunityHeader = memo(() => {
  const { message } = useApp()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const placeholder = useSearchPlaceholder()
  const isAgentPage = pathname.startsWith('/community/agent')

  const sidebarCollapsed = useHomeStore((s) => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useHomeStore((s) => s.toggleSidebarCollapsed)
  const upsertLocal = useAgentsStore((s) => s.upsertLocal)

  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleCreate = async (values: AgentFormValues) => {
    setSaving(true)
    try {
      const agent = await createAgent(values)
      upsertLocal(agent)
      setCreateOpen(false)
      message.success('已创建助理')

      const next = new URLSearchParams(searchParams.toString())
      next.set('category', AssistantCategory.Custom)
      next.delete('page')
      const query = next.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    } catch (error) {
      console.error('[community] create custom agent failed:', error)
      message.error('创建失败，请先登录后再试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Flex className={[styles.header, 'items-center gap-2']}>
        {sidebarCollapsed ? (
          <ActionIcon icon={PanelLeftOpen} size='small' title='展开侧栏' onClick={toggleSidebarCollapsed} />
        ) : null}
        {placeholder ? (
          <Flex className='w-full flex-1 flex-col'>
            <AgentSearch placeholder={placeholder} />
          </Flex>
        ) : null}
        {isAgentPage ? (
          <Button size='small' color="default" icon={Plus} onClick={() => setCreateOpen(true)}>
          </Button>
        ) : null}
      </Flex>
      {isAgentPage ? (
        <AgentFormModal
          confirmLoading={saving}
          open={createOpen}
          onCancel={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      ) : null}
    </>
  )
})

CommunityHeader.displayName = 'CommunityHeader'

export default CommunityHeader
