'use client'

import { Checkbox, Text, confirmModal, stopPropagation, Flex } from '@pure/ui'
import { memo, useSyncExternalStore } from 'react'

import Link from 'next/link'

import {
  isAuthAgreementAccepted,
  setAuthAgreementAccepted,
  subscribeAuthAgreement,
} from './agreement'

const AGREEMENT_TEXT_PROPS = { style: { fontSize: 13 }, type: 'secondary' } as const

const AgreementLinks = () => (
  <>
    <Link href='/terms' onClick={stopPropagation}>
      服务条款
    </Link>{' '}
    与{' '}
    <Link href='/privacy' onClick={stopPropagation}>
      隐私政策
    </Link>
  </>
)

export const confirmAuthAgreement = (onOk: () => void) => {
  confirmModal({
    cancelText: '取消',
    content: (
      <>
        点击“同意并继续”即表示你已阅读并同意 <AgreementLinks />。
      </>
    ),
    okText: '同意并继续',
    title: '确认服务条款与隐私政策',
    onOk: () => {
      setAuthAgreementAccepted(true)
      onOk()
    },
  })
}

export const withAuthAgreement = (action: () => void) => {
  if (isAuthAgreementAccepted()) {
    action()
    return
  }

  confirmAuthAgreement(action)
}

const AuthAgreement = memo(() => {
  const checked = useSyncExternalStore(subscribeAuthAgreement, isAuthAgreementAccepted, () => false)

  return (
    <Flex
      className='cursor-pointer items-center gap-2 select-none'
      onClick={() => setAuthAgreementAccepted(!checked)}
    >
      <span onClick={stopPropagation} onKeyDown={stopPropagation}>
        <Checkbox checked={checked} onChange={setAuthAgreementAccepted} />
      </span>
      <Text as='span' {...AGREEMENT_TEXT_PROPS}>
        我已阅读并同意 <AgreementLinks />
      </Text>
    </Flex>
  )
})

AuthAgreement.displayName = 'AuthAgreement'

export default AuthAgreement
