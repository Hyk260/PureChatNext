'use client'

import { Block, Button, Icon, List, Popover, Text, Flex } from '@pure/ui'
import type { ListClickInfo } from '@pure/ui'
import { toast, createStaticStyles, cssVar, Avatar } from '@lobehub/ui'
import { ChevronDownIcon, LogOut, Settings2, Send } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { memo, useCallback, useMemo, useState } from 'react'

import { signOutWorkspace } from '@/features/auth/signOutWorkspace'
import { useSession } from '@/libs/better-auth/client'
import { getDesktopApi } from '@/types/desktop'

import ReferralModal from '@/features/referrals/ReferralModal'

import DataStatistics from './DataStatistics'
import FreeCreditsSummary from './FreeCreditsSummary'

const styles = createStaticStyles(({ css }) => ({
  divider: css`
    height: 1px;
    margin-block: 4px;
    margin-inline: 12px;
    background: ${cssVar.colorSplit};
  `,
}))

interface UserInfoSectionProps {
  avatar: string
  email?: string | null
  name: string
  planLabel?: string
}

const UserInfoSection = memo<UserInfoSectionProps>(({ avatar, email, name, planLabel }) => (
  <Flex className='items-center gap-3 py-3 px-3'>
    <Flex className='items-center gap-2.5'>
      <Avatar
        alt={name}
        avatar={avatar}
        shape='circle'
        size={36}
        title={name.slice(0, 3).toUpperCase()}
      />
      <Flex className='flex-col flex-1'>
        <Flex className='items-center gap-2'>
          <Text as='span' className='leading-[1.4]' weight='bold'>
            {name}
          </Text>
        </Flex>
        {email ? (
          <Text as='span' className='leading-[1.4]' fontSize={12} type='secondary'>
            {email}
          </Text>
        ) : null}
      </Flex>
    </Flex>
  </Flex>
))

UserInfoSection.displayName = 'UserInfoSection'

const HomeUserTrigger = memo(() => {
  const router = useRouter()
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [referralOpen, setReferralOpen] = useState(false)
  const isDesktop = Boolean(getDesktopApi())

  const displayName = session?.user?.name ?? session?.user?.email?.split('@')[0] ?? '访客'

  const avatarFallback = session?.user ? displayName.slice(0, 2).toUpperCase() : '?'
  const avatar = session?.user?.image || avatarFallback

  const handleSignOut = useCallback(async () => {
    await signOutWorkspace()
    setOpen(false)
    toast.success('已退出登录')
    router.replace('/signin')
  }, [router])

  const menuItems = useMemo(
    () =>
      session?.user
        ? [
            {
              icon: Settings2,
              href: '/settings/profile',
              key: 'setting',
              label: '账号设置',
            },
            { icon: Send, key: 'referral', label: '邀请好友' },
            {
              danger: true,
              icon: LogOut,
              key: 'logout',
              label: <span>退出登录</span>,
            },
          ]
        : [],
    [session?.user]
  )

  const handleMenuClick = useCallback(
    ({ key, domEvent }: ListClickInfo) => {
      if (key === 'setting') {
        domEvent.preventDefault()
        setOpen(false)
        router.push('/settings/profile')
        return
      }
      if (key === 'referral') {
        setOpen(false)
        setReferralOpen(true)
        return
      }
      if (key === 'logout') {
        handleSignOut()
        return
      }

      setOpen(false)
    },
    [handleSignOut, router]
  )

  const menuContent = session?.user ? (
    <Flex className='flex-col gap-0.5 min-w-[300px]'>
      <UserInfoSection avatar={avatar} email={session.user.email} name={displayName} planLabel='免费版' />
      <DataStatistics />
      <FreeCreditsSummary onClick={() => setOpen(false)} />
      <div className={styles.divider} />
      <List compact className='p-1' selectable={false} items={menuItems} onClick={handleMenuClick} />
    </Flex>
  ) : (
    <Flex className='flex-col gap-0.5 min-w-[300px]'>
      <UserInfoSection avatar={avatar} name='访客' />
      <Flex className='flex-col py-3 px-4 w-full'>
        <Link className='text-inherit no-underline' href='/signin'>
          <Button block type='primary' onClick={() => setOpen(false)}>
            登录或注册
          </Button>
        </Link>
      </Flex>
    </Flex>
  )

  const popoverClassName = isDesktop ? '!top-[38px] !start-2 rounded-[10px]' : '!top-2 !start-2 rounded-[10px]'

  return (
    <>
      <ReferralModal open={referralOpen} onClose={() => setReferralOpen(false)} />
      <Popover
        arrow={false}
        content={menuContent}
        open={open}
        placement='topLeft'
        trigger='click'
        classNames={{
          content: 'p-0',
          root: popoverClassName,
        }}
        onOpenChange={setOpen}
      >
        <Block
          clickable
          horizontal
          align='center'
          className={'select-none'}
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
          <Avatar
            alt={displayName}
            avatar={avatar}
            shape='square'
            size={28}
            title={displayName.slice(0, 3).toUpperCase()}
          />
          <Flex className='items-center gap-1 overflow-hidden'>
            <Text as='span' className='min-w-0 flex-1' ellipsis weight={500}>
              {displayName}
            </Text>
            <Icon color={cssVar.colorTextDescription} icon={ChevronDownIcon} />
          </Flex>
        </Block>
      </Popover>
    </>
  )
})

HomeUserTrigger.displayName = 'HomeUserTrigger'

export default HomeUserTrigger
