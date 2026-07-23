'use client'

import { Avatar, Button, Flex, Typography } from 'antd'
import { useApp } from '@/components/AntdStaticMethods'
import { Block, Icon, Popover } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { ChevronDownIcon, LogOut, Settings2 } from 'lucide-react'
import Link from '@/utils/link'
import { memo, useCallback, useMemo, useState } from 'react'

import Menu from '@/components/Menu'
import { signOut, useSession } from '@/libs/better-auth/client'

import DataStatistics from './DataStatistics'

const styles = createStaticStyles(({ css }) => ({
  popover: css`
    inset-block-start: 8px !important;
    inset-inline-start: 8px !important;
    border-radius: 10px;
  `,
  popoverContent: css`
    padding: 0;
  `,
  trigger: css`
    user-select: none;
  `,
}))

interface UserInfoSectionProps {
  avatar: string
  email?: string | null
  name: string
}

const UserInfoSection = memo<UserInfoSectionProps>(({ avatar, email, name }) => (
  <Flex align='center' gap={12} style={{ paddingBlock: 12, paddingInline: 12 }}>
    <Flex align='center' gap={10}>
      <Avatar size={36} src={avatar} style={{ background: cssVar.colorFill }} />
      <Flex vertical flex={1}>
        <Typography.Text style={{ lineHeight: 1.4, fontWeight: 'bold' }}>
          {name}
        </Typography.Text>
        {email ? (
          <Typography.Text type='secondary' style={{ fontSize: 12, lineHeight: 1.4 }}>
            {email}
          </Typography.Text>
        ) : null}
      </Flex>
    </Flex>
  </Flex>
))

UserInfoSection.displayName = 'UserInfoSection'

const HomeUserTrigger = memo(() => {
  const { message } = useApp()
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)

  const displayName =
    session?.user?.name ?? session?.user?.email?.split('@')[0] ?? '访客'

  const avatarFallback = session?.user ? displayName.slice(0, 2).toUpperCase() : '?'
  const avatar = session?.user?.image || avatarFallback

  const handleSignOut = useCallback(async () => {
    await signOut()
    setOpen(false)
    message.success('已退出登录')
  }, [message])

  const settingsItems = useMemo(
    () =>
      session?.user
        ? [
            { type: 'divider' as const },
            {
              icon: <Icon icon={Settings2} />,
              key: 'setting',
              label: (
                <Link href='/settings/profile' style={{ color: 'inherit' }}>
                  账号设置
                </Link>
              ),
            },
          ]
        : [],
    [session?.user],
  )

  const logoutItems = useMemo(
    () =>
      session?.user
        ? [
            { type: 'divider' as const },
            {
              icon: <Icon icon={LogOut} />,
              key: 'logout',
              label: <span>退出登录</span>,
            },
          ]
        : [],
    [session?.user],
  )

  const handleMenuClick = useCallback(
    ({ key }: { key: string }) => {
      if (key === 'logout') {
        handleSignOut()
        return
      }

      setOpen(false)
    },
    [handleSignOut],
  )

  const menuContent = session?.user ? (
    <Flex vertical gap={2} style={{ minWidth: 300 }}>
      <UserInfoSection
        avatar={avatar}
        email={session.user.email}
        name={displayName}
      />
      <DataStatistics />
      <Menu items={settingsItems} onClick={handleMenuClick} />
      <Menu items={logoutItems} onClick={handleMenuClick} />
    </Flex>
  ) : (
    <Flex vertical gap={2} style={{ minWidth: 300 }}>
      <UserInfoSection avatar={avatar} name='访客' />
      <Flex vertical style={{ paddingBlock: 12, paddingInline: 16, width: '100%' }}>
        <Link href='/signin' style={{ color: 'inherit', textDecoration: 'none' }}>
          <Button block type='primary' onClick={() => setOpen(false)}>
            登录或注册
          </Button>
        </Link>
      </Flex>
    </Flex>
  )

  return (
    <Popover
      arrow={false}
      content={menuContent}
      open={open}
      placement='topLeft'
      trigger='click'
      classNames={{
        content: styles.popoverContent,
        root: styles.popover,
      }}
      onOpenChange={setOpen}
    >
      <Block
        clickable
        horizontal
        align='center'
        className={styles.trigger}
        gap={8}
        paddingBlock={2}
        variant='borderless'
        style={{
          minWidth: 32,
          overflow: 'hidden',
          paddingInlineEnd: 8,
          paddingInlineStart: 2,
        }}
      >
        <Avatar shape='square' size={28} src={avatar} />
        <Flex align='center' gap={4} style={{ overflow: 'hidden' }}>
          <Typography.Text ellipsis style={{ flex: 1, fontWeight: 500 }}>
            {displayName}
          </Typography.Text>
          <Icon color={cssVar.colorTextDescription} icon={ChevronDownIcon} />
        </Flex>
      </Block>
    </Popover>
  )
})

HomeUserTrigger.displayName = 'HomeUserTrigger'

export default HomeUserTrigger
