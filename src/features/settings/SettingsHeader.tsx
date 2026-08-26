'use client'

import { ActionIcon, Flexbox, Text } from '@pure/ui'
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
    <Flexbox horizontal align='center' className={styles.header}>
      {sidebarCollapsed ? (
        <ActionIcon
          className={styles.toggle}
          icon={PanelLeftOpen}
          onClick={toggleSidebarCollapsed}
          size='small'
          title='展开侧栏'
        />
      ) : null}
      <Flexbox align='center' className={styles.title} justify='center'>
        <Text strong>{title}</Text>
      </Flexbox>
    </Flexbox>
  )
})

SettingsHeader.displayName = 'SettingsHeader'

export default SettingsHeader
