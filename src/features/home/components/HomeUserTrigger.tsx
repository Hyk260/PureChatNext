'use client'

import { Avatar, Block, Button, Flexbox, Icon, Popover, Text } from '@lobehub/ui'
import { App } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { ChevronDownIcon, LogOut, Settings2 } from 'lucide-react'
import Link from 'next/link'
import { memo, useCallback, useMemo, useState } from 'react'

import Menu from '@/components/Menu'
import { signOut, useSession } from '@/libs/better-auth/client'

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
  <Flexbox horizontal align='center' gap={12} paddingBlock={12} paddingInline={12}>
    <Flexbox horizontal align='center' gap={10}>
      <Avatar avatar={avatar} background={cssVar.colorFill} size={36} />
      <Flexbox flex={1}>
        <Text style={{ lineHeight: 1.4 }} weight='bold'>
          {name}
        </Text>
        {email ? (
          <Text fontSize={12} style={{ lineHeight: 1.4 }} type='secondary'>
            {email}
          </Text>
        ) : null}
      </Flexbox>
    </Flexbox>
  </Flexbox>
))

UserInfoSection.displayName = 'UserInfoSection'

const HomeUserTrigger = memo(() => {
  const { message } = App.useApp()
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)

  const displayName =
    session?.user?.name ?? session?.user?.email?.split('@')[0] ?? '访客'

  const avatarText = session?.user
    ? displayName.slice(0, 2).toUpperCase()
    : '?'

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
        void handleSignOut()
        return
      }

      setOpen(false)
    },
    [handleSignOut],
  )

  const menuContent = session?.user ? (
    <Flexbox gap={2} style={{ minWidth: 300 }}>
      <UserInfoSection
        avatar={avatarText}
        name={displayName}
      />
      <Menu items={settingsItems} onClick={handleMenuClick} />
      <Menu items={logoutItems} onClick={handleMenuClick} />
    </Flexbox>
  ) : (
    <Flexbox gap={2} style={{ minWidth: 300 }}>
      <UserInfoSection avatar={avatarText} name='访客' />
      <Flexbox paddingBlock={12} paddingInline={16} width='100%'>
        <Link href='/signin' style={{ color: 'inherit', textDecoration: 'none' }}>
          <Button block type='primary' onClick={() => setOpen(false)}>
            登录或注册
          </Button>
        </Link>
      </Flexbox>
    </Flexbox>
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
        <Avatar avatar={avatarText} shape='square' size={28} />
        <Flexbox horizontal align='center' gap={4} style={{ overflow: 'hidden' }}>
          <Text ellipsis style={{ flex: 1 }} weight={500}>
            {displayName}
          </Text>
          <Icon color={cssVar.colorTextDescription} icon={ChevronDownIcon} />
        </Flexbox>
      </Block>
    </Popover>
  )
})

HomeUserTrigger.displayName = 'HomeUserTrigger'

export default HomeUserTrigger
