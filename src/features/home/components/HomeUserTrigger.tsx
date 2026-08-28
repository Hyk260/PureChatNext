'use client'

import { Avatar } from 'antd'
import { useApp } from '@/components/AntdStaticMethods'
import { Block, Button, Icon, Menu, Popover, Text, Flex } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { ChevronDownIcon, LogOut, Settings2 } from 'lucide-react'
import Link from '@/utils/link'
import { memo, useCallback, useMemo, useState } from 'react'

import { signOut, useSession } from '@/libs/better-auth/client'

import DataStatistics from './DataStatistics'
import FreeCreditsSummary from './FreeCreditsSummary'

const styles = createStaticStyles(({ css }) => ({
  divider: css`
    height: 1px;
    margin-block: 4px;
    margin-inline: 12px;
    background: ${cssVar.colorSplit};
  `,
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
  planLabel?: string
}

const UserInfoSection = memo<UserInfoSectionProps>(({ avatar, email, name, planLabel }) => (
  <Flex className='flex-row items-center gap-3 py-3 px-3'>
    <Flex className='flex-row items-center gap-2.5'>
      <Avatar size={36} src={avatar} style={{ background: cssVar.colorFill }} />
      <Flex className='flex-col flex-1'>
        <Flex className='flex-row items-center gap-2'>
          <Text as='span' style={{ lineHeight: 1.4 }} weight='bold'>
            {name}
          </Text>
          {planLabel ? (
            <Text
              as='span'
              fontSize={12}
              noWrap
              type='secondary'
              style={{
                background: cssVar.colorFillTertiary,
                borderRadius: 999,
                lineHeight: '22px',
                paddingInline: 8,
              }}
            >
              {planLabel}
            </Text>
          ) : null}
        </Flex>
        {email ? (
          <Text as='span' fontSize={12} type='secondary' style={{ lineHeight: 1.4 }}>
            {email}
          </Text>
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

  const displayName = session?.user?.name ?? session?.user?.email?.split('@')[0] ?? '访客'

  const avatarFallback = session?.user ? displayName.slice(0, 2).toUpperCase() : '?'
  const avatar = session?.user?.image || avatarFallback

  const handleSignOut = useCallback(async () => {
    await signOut()
    setOpen(false)
    message.success('已退出登录')
  }, [message])

  const menuItems = useMemo(
    () =>
      session?.user
        ? [
            {
              icon: <Icon icon={Settings2} />,
              key: 'setting',
              label: (
                <Link href='/settings/profile' style={{ color: 'inherit' }}>
                  账号设置
                </Link>
              ),
            },
            // { type: 'divider' as const },
            {
              danger: true,
              icon: <Icon icon={LogOut} />,
              key: 'logout',
              label: <span>退出登录</span>,
            },
          ]
        : [],
    [session?.user]
  )

  const handleMenuClick = useCallback(
    ({ key }: { key: string }) => {
      if (key === 'logout') {
        handleSignOut()
        return
      }

      setOpen(false)
    },
    [handleSignOut]
  )

  const menuContent = session?.user ? (
    <Flex className='flex-col gap-0.5 min-w-[300px]'>
      <UserInfoSection avatar={avatar} email={session.user.email} name={displayName} planLabel='免费版' />
      <DataStatistics />
      <FreeCreditsSummary onClick={() => setOpen(false)} />
      <div className={styles.divider} />
      <Menu compact items={menuItems} onClick={handleMenuClick} />
    </Flex>
  ) : (
    <Flex className='flex-col gap-0.5 min-w-[300px]'>
      <UserInfoSection avatar={avatar} name='访客' />
      <Flex className='flex-col py-3 px-4 w-full'>
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
        <Flex className='flex-row items-center gap-1 overflow-hidden'>
          <Text as='span' ellipsis style={{ flex: 1 }} weight={500}>
            {displayName}
          </Text>
          <Icon color={cssVar.colorTextDescription} icon={ChevronDownIcon} />
        </Flex>
      </Block>
    </Popover>
  )
})

HomeUserTrigger.displayName = 'HomeUserTrigger'

export default HomeUserTrigger
