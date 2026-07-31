'use client'

import { ActionIcon, Flexbox } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { PanelLeftOpen } from 'lucide-react'
import { memo } from 'react'

import { useHomeStore } from '@/features/home/store/useHomeStore'

const styles = createStaticStyles(({ css }) => ({
  header: css`
    flex: none;
    height: 44px;
    padding-inline: 8px;
    background: ${cssVar.colorBgContainer};
  `,
}))

const SettingsHeader = memo(() => {
  const sidebarCollapsed = useHomeStore((s) => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useHomeStore((s) => s.toggleSidebarCollapsed)

  if (!sidebarCollapsed) return null

  return (
    <Flexbox horizontal align='center' className={styles.header}>
      <ActionIcon icon={PanelLeftOpen} onClick={toggleSidebarCollapsed} size='small' title='展开侧栏' />
    </Flexbox>
  )
})

SettingsHeader.displayName = 'SettingsHeader'

export default SettingsHeader
