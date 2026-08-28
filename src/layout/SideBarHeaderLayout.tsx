'use client'

import { ActionIcon, Icon, Text, Flex } from '@pure/ui'
import { Breadcrumb } from 'antd'
import type { BreadcrumbProps } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { ChevronRightIcon, HomeIcon, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useRouter } from '@/utils/navigation'
import { memo } from 'react'
import type { MouseEvent, ReactNode } from 'react'

import { useHomeStore } from '@/features/home/store/useHomeStore'

const prefixCls = 'ant'

const styles = createStaticStyles(({ css, cssVar: token }) => ({
  breadcrumb: css`
    ol {
      align-items: center;
    }

    .${prefixCls}-breadcrumb-separator {
      margin-inline: 4px;
    }

    .${prefixCls}-breadcrumb-link {
      display: flex !important;
      align-items: center !important;
      font-size: 12px;
      color: ${token.colorTextDescription};
    }

    a.${prefixCls}-breadcrumb-link {
      color: inherit;
      text-decoration: none;

      &:hover {
        color: ${token.colorText};
      }
    }
  `,
  container: css`
    overflow: hidden;
  `,
}))

interface SideBarHeaderLayoutProps {
  breadcrumb?: BreadcrumbProps['items']
  /** 受控折叠状态；未传时回退到 useHomeStore.sidebarCollapsed */
  collapsed?: boolean
  homeHref?: string
  left?: ReactNode
  /** 受控折叠切换；未传时回退到 useHomeStore.toggleSidebarCollapsed */
  onToggleCollapsed?: () => void
  right?: ReactNode
  showHomeIcon?: boolean
  showTogglePanelButton?: boolean
}

const SideBarHeaderLayout = memo<SideBarHeaderLayoutProps>(
  ({
    breadcrumb = [],
    collapsed,
    homeHref = '/',
    left,
    onToggleCollapsed,
    right,
    showHomeIcon = true,
    showTogglePanelButton = true,
  }) => {
    const homeSidebarCollapsed = useHomeStore((s) => s.sidebarCollapsed)
    const toggleHomeSidebarCollapsed = useHomeStore((s) => s.toggleSidebarCollapsed)
    const sidebarCollapsed = collapsed ?? homeSidebarCollapsed
    const toggleSidebarCollapsed = onToggleCollapsed ?? toggleHomeSidebarCollapsed
    const router = useRouter()

    const breadcrumbItems: BreadcrumbProps['items'] = [
      ...(showHomeIcon
        ? [
            {
              href: homeHref,
              title: <Icon icon={HomeIcon} size={14} />,
            },
          ]
        : []),
      ...breadcrumb,
    ].map((item) => ({
      ...item,
      onClick: (event: MouseEvent<HTMLAnchorElement>) => {
        if (event.defaultPrevented) return

        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

        const href = item.href
        if (href) {
          event.preventDefault()
          router.push(String(href))
        }
      },
    }))

    const leftContent = left ? (
      <Flex className='flex-row items-center flex-1 gap-0.5 overflow-hidden'>
        {typeof left === 'string' ? (
          <Text ellipsis style={{ fontSize: 16, fontWeight: 500 }}>
            {left}
          </Text>
        ) : (
          left
        )}
      </Flex>
    ) : (
      <Flex className='flex-col flex-1 px-1.5'>
        <Breadcrumb
          className={styles.breadcrumb}
          separator={<Icon color={cssVar.colorTextDescription} icon={ChevronRightIcon} size={12} />}
          items={breadcrumbItems}
        />
      </Flex>
    )

    return (
      <Flex className={[styles.container, 'flex-between flex-none p-[0px_6px] h-[40px]']}>
        {leftContent}
        <Flex className='flex-row items-center flex-none gap-0.5 justify-end'>
          {right}
          {showTogglePanelButton ? (
            <ActionIcon
              icon={sidebarCollapsed ? PanelLeftOpen : PanelLeftClose}
              size='small'
              title={sidebarCollapsed ? '展开侧栏' : '折叠侧栏'}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                toggleSidebarCollapsed()
              }}
            />
          ) : null}
        </Flex>
      </Flex>
    )
  }
)

SideBarHeaderLayout.displayName = 'SideBarHeaderLayout'

export default SideBarHeaderLayout
