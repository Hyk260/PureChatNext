'use client'

import { App } from 'antd'
import Link from '@/utils/link'
import { usePathname } from '@/utils/navigation'
import { memo } from 'react'

import NavItem from '@/components/NavItem'
import { HOME_BOTTOM_NAV } from '@/const/home/nav'
import { Block, Flexbox, Icon, Text } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { ArrowUpRight } from 'lucide-react'

const styles = createStaticStyles(({ css }) => ({
  footer: css`
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
  `,
  upgrade: css`
    cursor: pointer;
    border-radius: ${cssVar.borderRadiusLG};
    transition: background 0.2s ${cssVar.motionEaseOut};

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
}))

const SidebarFooter = memo(() => {
  const pathname = usePathname()
  const { message } = App.useApp()

  return (
    <Flexbox className={styles.footer} gap={8} padding={8}>
      <Flexbox gap={1}>
        {HOME_BOTTOM_NAV.map((item) => {
          const active = item.href ? pathname.startsWith(item.href) : false

          if (!item.href || item.href === '#') {
            return (
              <NavItem
                key={item.key}
                icon={item.icon}
                title={item.title}
                onItemClick={() => message.info('功能即将推出')}
              />
            )
          }

          return (
            <Link key={item.key} href={item.href} style={{ color: 'inherit', textDecoration: 'none' }}>
              <NavItem active={active} clickable icon={item.icon} title={item.title} />
            </Link>
          )
        })}
      </Flexbox>

      {/* <Block
        horizontal
        align='center'
        className={styles.upgrade}
        gap={8}
        padding={12}
        variant='filled'
        onClick={() => message.info('升级方案即将推出')}
      >
        <Flexbox flex={1} gap={2}>
          <Text fontSize={13} strong>
            升级方案
          </Text>
          <Text fontSize={12} type='secondary'>
            解锁更多模型与高级功能
          </Text>
        </Flexbox>
        <Icon icon={ArrowUpRight} size={16} />
      </Block> */}
    </Flexbox>
  )
})

SidebarFooter.displayName = 'SidebarFooter'

export default SidebarFooter
