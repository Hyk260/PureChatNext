'use client'

import { Accordion, AccordionItem, Flexbox, Icon, ProviderIcon, ScrollShadow, SearchBar, Text } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { LayoutGrid, Search } from 'lucide-react'
import Link from '@/utils/link'
import { usePathname } from '@/utils/navigation'
import { memo, useMemo, useState } from 'react'

import NavItem from '@/components/NavItem'

import { SETTINGS_PROVIDER_IDS, getSettingsProviderMeta } from './const'
import { useProviderConfigStore } from './store/useProviderConfigStore'
import type { ProviderId } from './types'

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
  searchBar: css`
    height: 40px;
    background: ${cssVar.colorBgContainer};
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  status: css`
    width: 6px;
    height: 6px;
    flex: none;
    border-radius: 50%;
    background: ${cssVar.colorSuccess};
  `,
}))

const ProviderNavItem = memo<{ id: ProviderId; active: boolean; enabled: boolean }>(({ id, active, enabled }) => {
  const meta = getSettingsProviderMeta(id)

  return (
    <Link href={`/settings/provider/${id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
      <NavItem
        active={active}
        clickable
        title={
          <Flexbox horizontal align='center' gap={8} width='100%'>
            <ProviderIcon provider={id} size={18} type='color' />
            <Text ellipsis style={{ flex: 1, minWidth: 0 }}>
              {meta.name}
            </Text>
            {enabled ? <span className={styles.status} /> : null}
          </Flexbox>
        }
      />
    </Link>
  )
})

ProviderNavItem.displayName = 'ProviderNavItem'

const ProviderSettingsNav = memo(() => {
  const pathname = usePathname()
  const [keyword, setKeyword] = useState('')
  const configs = useProviderConfigStore((s) => s.configs)

  const activeId = useMemo(() => {
    const segment = pathname.split('/')[3]
    return segment && segment !== 'all' ? segment : null
  }, [pathname])

  const isAllActive = pathname === '/settings/provider/all' || pathname === '/settings/provider'

  const filteredIds = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return SETTINGS_PROVIDER_IDS

    return SETTINGS_PROVIDER_IDS.filter((id) => {
      const meta = getSettingsProviderMeta(id)
      return meta.name.toLowerCase().includes(q) || meta.identifier.toLowerCase().includes(q)
    })
  }, [keyword])

  const enabledIds = filteredIds.filter((id) => configs[id]?.enabled)
  const disabledIds = filteredIds.filter((id) => !configs[id]?.enabled)

  return (
    <Flexbox className={styles.menu} height='100vh'>
      <Flexbox align='center' justify='center' className={styles.searchBar}>
        <SearchBar
          allowClear
          placeholder='搜索服务商'
          prefix={<Icon color={cssVar.colorTextDescription} icon={Search} size={14} style={{ marginInlineEnd: 4 }} />}
          style={{ width: '100%' }}
          value={keyword}
          variant='borderless'
          onInputChange={setKeyword}
        />
      </Flexbox>
      <ScrollShadow size={2} style={{ flex: 1, minHeight: 0, width: '100%' }}>
        <Flexbox gap={4} paddingInline={4} style={{ paddingBlock: '0 32px', marginBlockStart: 8 }}>
          <Link href='/settings/provider/all' style={{ color: 'inherit', textDecoration: 'none' }}>
            <NavItem active={isAllActive} clickable icon={LayoutGrid} title='全部' />
          </Link>
          <Accordion defaultExpandedKeys={['enabled', 'disabled']} gap={4}>
            <AccordionItem
              itemKey='enabled'
              paddingBlock={4}
              paddingInline='8px 4px'
              title={
                <Text ellipsis type='secondary' style={{ fontSize: 12, fontWeight: 500 }}>
                  已启用 · {enabledIds.length}
                </Text>
              }
            >
              <Flexbox gap={1} paddingBlock={1}>
                {enabledIds.length > 0 ? (
                  enabledIds.map((id) => <ProviderNavItem active={activeId === id} enabled id={id} key={id} />)
                ) : (
                  <Text type='secondary' style={{ fontSize: 12, paddingBlock: 6, paddingInline: 12 }}>
                    暂无
                  </Text>
                )}
              </Flexbox>
            </AccordionItem>
            <AccordionItem
              itemKey='disabled'
              paddingBlock={4}
              paddingInline='8px 4px'
              title={
                <Text ellipsis type='secondary' style={{ fontSize: 12, fontWeight: 500 }}>
                  未启用 · {disabledIds.length}
                </Text>
              }
            >
              <Flexbox gap={1} paddingBlock={1}>
                {disabledIds.length > 0 ? (
                  disabledIds.map((id) => <ProviderNavItem active={activeId === id} enabled={false} id={id} key={id} />)
                ) : (
                  <Text type='secondary' style={{ fontSize: 12, paddingBlock: 6, paddingInline: 12 }}>
                    暂无
                  </Text>
                )}
              </Flexbox>
            </AccordionItem>
          </Accordion>
        </Flexbox>
      </ScrollShadow>
    </Flexbox>
  )
})

ProviderSettingsNav.displayName = 'ProviderSettingsNav'

export default ProviderSettingsNav
