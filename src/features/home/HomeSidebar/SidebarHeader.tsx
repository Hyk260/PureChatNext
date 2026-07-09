'use client'

import { ActionIcon, Flexbox } from '@lobehub/ui'
import { App, Badge } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { BellIcon } from 'lucide-react'
import { memo } from 'react'

import HomeUserTrigger from '@/features/home/components/HomeUserTrigger'
import SideBarHeaderLayout from '@/layout/SideBarHeaderLayout'

const styles = createStaticStyles(({ css }) => ({
  bell: css`
    color: ${cssVar.colorTextSecondary};
  `,
}))

const SidebarHeader = memo(() => {
  const { message } = App.useApp()

  return (
    <SideBarHeaderLayout
      left={<HomeUserTrigger />}
      // right={
      //   <Badge dot size='small'>
      //     <ActionIcon
      //       className={styles.bell}
      //       icon={BellIcon}
      //       size='small'
      //       title='通知'
      //       onClick={() => message.info('通知功能即将推出')}
      //     />
      //   </Badge>
      // }
    />
  )
})

SidebarHeader.displayName = 'SidebarHeader'

export default SidebarHeader
