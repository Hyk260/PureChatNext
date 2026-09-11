'use client'

import { Alert, Text } from '@pure/ui'
import { memo } from 'react'
import { Link } from 'react-router'

import { getSettingsProviderMeta, isSettingsProviderId } from '@/features/settings/provider/const'
import { secretForProvider, useProviderSecrets } from '@/features/settings/provider/secretsApi'

interface MessengerProviderSecretHintProps {
  provider: string
}

/** 渠道页提示：BYOK 必须先保存到账号，网关读不到浏览器密钥。 */
export const MessengerProviderSecretHint = memo<MessengerProviderSecretHintProps>(({ provider }) => {
  const { data } = useProviderSecrets()
  if (!isSettingsProviderId(provider) || provider === 'purechat') return null

  const saved = secretForProvider(data, provider)
  if (saved) {
    return (
      <Text type='secondary' style={{ fontSize: 12 }}>
        将使用账号中已保存的 API Key（sk••••{saved.keyHint}）
      </Text>
    )
  }

  const providerName = getSettingsProviderMeta(provider).name

  return (
    <Alert
      showIcon
      type='warning'
      title='尚未设置密钥'
      description={
        <span>
          请先设置 API Key，前往 <Link to={`/settings/provider/${provider}`}>{providerName}</Link>设置
        </span>
      }
    />
  )
})

MessengerProviderSecretHint.displayName = 'MessengerProviderSecretHint'
