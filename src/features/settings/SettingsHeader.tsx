'use client'

import { ActionIcon, Flex, Text } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { PanelLeftOpen } from 'lucide-react'
import { memo, useMemo } from 'react'

import { useHomeStore } from '@/features/home/store/useHomeStore'
import { getSettingsTabLabel } from '@/features/settings/useSettingsCategory'
import { usePathname } from '@/utils/navigation'

const styles = createStaticStyles(({ css }) => ({
  header: css`
    position: relative;
    flex: none;
    height: 40px;
    padding-inline: 8px;
    background: ${cssVar.colorBgContainer};
  `,
  title: css`
    position: absolute;
    inset-inline: 0;
    pointer-events: none;
    text-align: center;
  `,
  toggle: css`
    position: relative;
    z-index: 1;
  `,
}))

const SettingsHeader = memo(() => {
  const pathname = usePathname()
  const sidebarCollapsed = useHomeStore((s) => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useHomeStore((s) => s.toggleSidebarCollapsed)

  const title = useMemo(() => getSettingsTabLabel(pathname.split('/')[2]), [pathname])

  return (
    <Flex className={[styles.header, 'flex-row items-center']}>
      {sidebarCollapsed ? (
        <ActionIcon
          className={styles.toggle}
          icon={PanelLeftOpen}
          onClick={toggleSidebarCollapsed}
          size='small'
          title='展开侧栏'
        />
      ) : null}
      <Flex className={[styles.title, 'flex-col-center']}>
        <Text strong>{title}</Text>
      </Flex>
    </Flex>
  )
})

SettingsHeader.displayName = 'SettingsHeader'

export default SettingsHeader
