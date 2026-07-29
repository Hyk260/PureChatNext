'use client'

import { Icon, ProviderIcon, ScrollShadow, Text } from '@pure/ui'
import { Flex, Input } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { LayoutGrid, Search } from 'lucide-react'
import Link from '@/utils/link'
import { usePathname } from '@/utils/navigation'
import { memo, useMemo, useState } from 'react'

import NavItem from '@/components/NavItem'

import { SETTINGS_PROVIDER_IDS, getSettingsProviderMeta } from './const'
import { useProviderConfigStore } from './store/useProviderConfigStore'
import { type ProviderId } from './types'

const MENU_WIDTH = 280

const styles = createStaticStyles(({ css }) => ({
  groupTitle: css`
    padding-block: 8px 4px;
    padding-inline: 12px;
  `,
  menu: css`
    flex: none;
    width: ${MENU_WIDTH}px;
    min-width: ${MENU_WIDTH}px;
    height: 100%;
    overflow: hidden;
    background: ${cssVar.colorBgContainer};
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  searchBar: css`
    position: sticky;
    z-index: 50;
    inset-block-start: 0;
    margin-block-end: 8px;
    padding: 8px;
    background: ${cssVar.colorBgContainer};
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    .ant-input-affix-wrapper {
      border-radius: 8px;
    }
  `,
}))

const ProviderNavItem = memo<{ id: ProviderId; active: boolean }>(({ id, active }) => {
  const meta = getSettingsProviderMeta(id)

  return (
    <Link href={`/settings/provider/${id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
      <NavItem
        active={active}
        clickable
        title={
          <Flex align='center' gap={8}>
            <ProviderIcon provider={id} size={18} type='color' />
            <span>{meta.name}</span>
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
    <Flex vertical className={styles.menu} style={{ height: '100%' }}>
      <div className={styles.searchBar}>
        <Input
          allowClear
          placeholder='搜索服务商'
          prefix={<Icon color={cssVar.colorTextDescription} icon={Search} size={14} style={{ marginInlineEnd: 4 }} />}
          value={keyword}
          variant='borderless'
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>
      <ScrollShadow size={2} style={{ flex: 1, minHeight: 0, width: '100%' }}>
        <Flex vertical gap={4} style={{ paddingBlock: '0 32px', paddingInline: 4 }}>
          <Link href='/settings/provider/all' style={{ color: 'inherit', textDecoration: 'none' }}>
            <NavItem active={isAllActive} clickable icon={LayoutGrid} title='全部' />
          </Link>
          <div className={styles.groupTitle}>
            <Text type='secondary' style={{ fontSize: 12, fontWeight: 500 }}>
              已启用
            </Text>
          </div>
          <Flex vertical gap={1}>
            {enabledIds.length > 0 ? (
              enabledIds.map((id) => <ProviderNavItem active={activeId === id} id={id} key={id} />)
            ) : (
              <Text type='secondary' style={{ fontSize: 12, paddingBlock: 4, paddingInline: 12 }}>
                暂无
              </Text>
            )}
          </Flex>
          <div className={styles.groupTitle}>
            <Text type='secondary' style={{ fontSize: 12, fontWeight: 500 }}>
              未启用
            </Text>
          </div>
          <Flex vertical gap={1}>
            {disabledIds.length > 0 ? (
              disabledIds.map((id) => <ProviderNavItem active={activeId === id} id={id} key={id} />)
            ) : (
              <Text type='secondary' style={{ fontSize: 12, paddingBlock: 4, paddingInline: 12 }}>
                暂无
              </Text>
            )}
          </Flex>
        </Flex>
      </ScrollShadow>
    </Flex>
  )
})

ProviderSettingsNav.displayName = 'ProviderSettingsNav'

export default ProviderSettingsNav
