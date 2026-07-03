'use client'

import { Text } from '@lobehub/ui'
import { memo } from 'react'

const AuthAgreement = memo(() => {
  return (
    <Text fontSize={13} style={{ display: 'block', marginBlockStart: 8 }} type="secondary">
      继续即表示你已阅读并同意服务条款与隐私政策
    </Text>
  )
})

AuthAgreement.displayName = 'AuthAgreement'

export default AuthAgreement
