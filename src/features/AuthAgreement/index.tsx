'use client'

import { Text } from '@pure/ui'
import { memo } from 'react'

import Link from '@/utils/link'

const AuthAgreement = memo(() => {
  return (
    <Text type='secondary' style={{ fontSize: 13, display: 'block', marginBlockStart: 8 }}>
      继续即表示你已阅读并同意 <Link href='/terms'>服务条款</Link> 与 <Link href='/privacy'>隐私政策</Link>
    </Text>
  )
})

AuthAgreement.displayName = 'AuthAgreement'

export default AuthAgreement
