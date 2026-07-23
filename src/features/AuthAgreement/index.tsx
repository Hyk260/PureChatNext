'use client'

import { Typography } from 'antd'
import { memo } from 'react'

const AuthAgreement = memo(() => {
  return (
    <Typography.Text type='secondary' style={{ fontSize: 13, display: 'block', marginBlockStart: 8 }}>
      继续即表示你已阅读并同意服务条款与隐私政策
    </Typography.Text>
  )
})

AuthAgreement.displayName = 'AuthAgreement'

export default AuthAgreement
