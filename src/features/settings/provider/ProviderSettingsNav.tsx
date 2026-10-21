'use client'

import {
  AccordionRoot,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
  ActionIcon,
  Flex,
  Icon,
  SearchBar,
  Text,
} from '@pure/ui'
import { toast, createStaticStyles, cssVar } from '@lobehub/ui'
import { LayoutGrid, Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { memo, useMemo, useRef, useState } from 'react'

import NavItem from '@/components/NavItem'
import Scrollbar from '@/components/Scrollbar'

import { createCustomProvider } from './customProvidersApi'
import CustomProviderModal from './CustomProviderModal'
import { SETTINGS_PROVIDER_IDS, getSettingsProviderMeta } from './const'
import ProviderMark from './ProviderMark'
import { useProviderConfigStore } from './store/useProviderConfigStore'
import { useCustomProviderRegistry } from './useCustomProviderRegistry'
import type { CustomProviderDefinition, ProviderId } from './types'

const MENU_WIDTH = 280

const styles = createStaticStyles(({ css }) => ({
  menu: css`
    flex: none;
    width: ${MENU_WIDTH}px;
    min-width: ${MENU_WIDTH}px;
    height: 100vh;
    overflow: hidden;
    background: ${cssVar.colorBgContainer};
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};

    @media (max-width: 768px) {
      display: none;
    }
  `,
  status: css`
    width: 6px;
    height: 6px;
    flex: none;
    border-radius: 50%;
    background: ${cssVar.colorSuccess};
  `,
}))

const ProviderNavItem = memo<{
  active: boolean
  customProviders: CustomProviderDefinition[]
  enabled: boolean
  id: ProviderId
}>(({ customProviders, id, active, enabled }) => {
  const meta = getSettingsProviderMeta(id, customProviders)

  return (
    <Link className='text-inherit no-underline' href={`/settings/provider/${id}`}>
      <NavItem
        active={active}
        clickable
        title={
          <Flex className='items-center gap-2 w-full'>
            <ProviderMark id={id} logo={meta.logo} name={meta.name} size={18} />
            <Text className='min-w-0 flex-1' ellipsis>
              {meta.name}
            </Text>
            {enabled ? <span className={styles.status} /> : null}
          </Flex>
        }
      />
    </Link>
  )
})

ProviderNavItem.displayName = 'ProviderNavItem'

const ProviderSettingsNav = memo(() => {
  const pathname = usePathname()
  const [keyword, setKeyword] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const createButtonRef = useRef<HTMLButtonElement>(null)
  const registry = useCustomProviderRegistry()
  const configs = useProviderConfigStore((s) => s.configs)
  const customProviders = useProviderConfigStore((s) => s.customProviders)
  const setCustomProviders = useProviderConfigStore((s) => s.setCustomProviders)
  const availableCustomProviders = registry.data ?? customProviders
  const allProviderIds = useMemo(
    () => [...SETTINGS_PROVIDER_IDS, ...availableCustomProviders.map((provider) => provider.id)],
    [availableCustomProviders]
  )

  const activeId = useMemo(() => {
    const segment = pathname.split('/')[3]
    return segment && segment !== 'all' ? segment : null
  }, [pathname])

  const isAllActive = pathname === '/settings/provider/all' || pathname === '/settings/provider'

  const filteredIds = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return allProviderIds

    return allProviderIds.filter((id) => {
      const meta = getSettingsProviderMeta(id, availableCustomProviders)
      return meta.name.toLowerCase().includes(q) || meta.identifier.toLowerCase().includes(q)
    })
  }, [allProviderIds, availableCustomProviders, keyword])

  const enabledIds = filteredIds.filter(
    (id) => configs[id]?.enabled ?? availableCustomProviders.find((provider) => provider.id === id)?.enabled ?? false
  )
  const disabledIds = filteredIds.filter((id) => !enabledIds.includes(id))

  const handleCreateProvider = async (provider: Parameters<typeof createCustomProvider>[0]) => {
    setCreating(true)
    try {
      const created = await createCustomProvider(provider)
      const nextProviders = [...availableCustomProviders, created]
      await registry.mutate(nextProviders, { revalidate: false })
      setCustomProviders(nextProviders)
      setCreateModalOpen(false)
      toast.success(`已创建服务商 ${created.name}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建服务商失败')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Flex className={[styles.menu, 'flex-col h-screen']}>
      <Flex className={['h-10 bg-app-surface border-b border-app-border-secondary', 'items-center gap-1 px-2']}>
        <SearchBar
          allowClear
          className='min-w-0 flex-1'
          placeholder='搜索服务商'
          prefix={<Icon color={cssVar.colorTextDescription} icon={Search} size={14} style={{ marginInlineEnd: 4 }} />}
          value={keyword}
          variant='borderless'
          onInputChange={setKeyword}
        />
        <ActionIcon
          ref={createButtonRef}
          aria-label='创建自定义服务商'
          icon={Plus}
          size='small'
          title='创建自定义服务商'
          onClick={() => setCreateModalOpen(true)}
        />
      </Flex>
      <Scrollbar style={{ flex: 1, minHeight: 0, width: '100%' }}>
        <Flex className='mt-2 flex-col gap-1 px-1 py-[0_32px]'>
          <Link className='text-inherit no-underline' href='/settings/provider/all'>
            <NavItem active={isAllActive} clickable icon={LayoutGrid} title='全部' />
          </Link>
          <AccordionRoot multiple defaultValue={['enabled', 'disabled']} style={{ gap: 4 }}>
            <AccordionItem value='enabled'>
              <AccordionHeader style={{ paddingBlock: 4, paddingInline: '8px 4px' }}>
                <AccordionTrigger>
                  <Text className='text-[12px] font-medium' ellipsis type='secondary'>
                    已启用 · {enabledIds.length}
                  </Text>
                </AccordionTrigger>
              </AccordionHeader>
              <AccordionPanel>
                <Flex className='flex-col gap-px py-px'>
                  {enabledIds.length > 0 ? (
                    enabledIds.map((id) => (
                      <ProviderNavItem
                        active={activeId === id}
                        customProviders={availableCustomProviders}
                        enabled
                        id={id}
                        key={id}
                      />
                    ))
                  ) : (
                    <Text className='px-3 py-1.5 text-[12px]' type='secondary'>
                      暂无
                    </Text>
                  )}
                </Flex>
              </AccordionPanel>
            </AccordionItem>
            <AccordionItem value='disabled'>
              <AccordionHeader style={{ paddingBlock: 4, paddingInline: '8px 4px' }}>
                <AccordionTrigger>
                  <Text className='text-[12px] font-medium' ellipsis type='secondary'>
                    未启用 · {disabledIds.length}
                  </Text>
                </AccordionTrigger>
              </AccordionHeader>
              <AccordionPanel>
                <Flex className='flex-col gap-px py-px'>
                  {disabledIds.length > 0 ? (
                    disabledIds.map((id) => (
                      <ProviderNavItem
                        active={activeId === id}
                        customProviders={availableCustomProviders}
                        enabled={false}
                        id={id}
                        key={id}
                      />
                    ))
                  ) : (
                    <Text className='px-3 py-1.5 text-[12px]' type='secondary'>
                      暂无
                    </Text>
                  )}
                </Flex>
              </AccordionPanel>
            </AccordionItem>
          </AccordionRoot>
        </Flex>
      </Scrollbar>
      <CustomProviderModal
        afterClose={() => createButtonRef.current?.focus({ preventScroll: true })}
        existingProviderIds={allProviderIds}
        loading={creating}
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onCreate={handleCreateProvider}
      />
    </Flex>
  )
})

ProviderSettingsNav.displayName = 'ProviderSettingsNav'

export default ProviderSettingsNav
