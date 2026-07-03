'use client'

import { Button } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { message } from '@/components/AntdStaticMethods'
import {
  BUILTIN_BETTER_AUTH_PROVIDERS,
  SSO_PROVIDER_LABELS,
} from '@/libs/better-auth/constants'
import { linkSocial, listAccounts, oauth2, unlinkAccount } from '@/libs/better-auth/auth-client'
import { useAuthConfig } from '@/libs/better-auth/use-auth-config'

import { SettingRow } from './SettingRow'

interface LinkedAccount {
  accountId: string
  id: string
  providerId: string
}

interface LinkedAccountsSettingProps {
  userEmail: string | null
}

const CALLBACK_URL = '/settings/profile'

function getProviderLabel(providerId: string) {
  return SSO_PROVIDER_LABELS[providerId] ?? providerId
}

function isBuiltinProvider(provider: string) {
  return (BUILTIN_BETTER_AUTH_PROVIDERS as readonly string[]).includes(provider)
}

export function LinkedAccountsSetting({ userEmail }: LinkedAccountsSettingProps) {
  const { config, ready } = useAuthConfig()
  const [accounts, setAccounts] = useState<LinkedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)

  const loadAccounts = useCallback(async () => {
    setLoading(true)

    try {
      const { data, error } = await listAccounts()

      if (error) {
        message.error(error.message ?? '加载关联账户失败')
        return
      }

      setAccounts((data ?? []) as LinkedAccount[])
    } catch {
      message.error('加载关联账户失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  const oauthAccounts = useMemo(
    () => accounts.filter((account) => account.providerId !== 'credential'),
    [accounts],
  )

  const linkedProviderIds = useMemo(
    () => new Set(oauthAccounts.map((account) => account.providerId)),
    [oauthAccounts],
  )

  const availableProviders = useMemo(() => {
    if (!ready) return []

    return config.oAuthSSOProviders.filter((provider) => !linkedProviderIds.has(provider))
  }, [config.oAuthSSOProviders, linkedProviderIds, ready])

  const handleLink = async (provider: string) => {
    setLinkingProvider(provider)

    try {
      const result = isBuiltinProvider(provider)
        ? await linkSocial({ callbackURL: CALLBACK_URL, provider })
        : await oauth2.link({ callbackURL: CALLBACK_URL, providerId: provider })

      if (result && 'error' in result && result.error) {
        message.error(result.error.message ?? '关联账户失败')
      }
    } catch {
      message.error('关联账户失败')
    } finally {
      setLinkingProvider(null)
    }
  }

  const handleUnlink = async (account: LinkedAccount) => {
    if (oauthAccounts.length <= 1 && !accounts.some((item) => item.providerId === 'credential')) {
      message.warning('至少需要保留一种登录方式')
      return
    }

    setUnlinkingId(account.id)

    try {
      const { error } = await unlinkAccount({
        accountId: account.accountId,
        providerId: account.providerId,
      })

      if (error) {
        message.error(error.message ?? '解绑失败')
        return
      }

      message.success('账户已解绑')
      await loadAccounts()
    } catch {
      message.error('解绑失败')
    } finally {
      setUnlinkingId(null)
    }
  }

  return (
    <SettingRow label="已关联的账户" vertical>
      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : oauthAccounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无关联的第三方账户</p>
        ) : (
          oauthAccounts.map((account) => (
            <div
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2"
              key={account.id}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{getProviderLabel(account.providerId)}</p>
                <p className="truncate text-xs text-muted-foreground">{userEmail || account.accountId}</p>
              </div>
              <Button
                danger
                loading={unlinkingId === account.id}
                onClick={() => handleUnlink(account)}
                size="small"
              >
                解绑
              </Button>
            </div>
          ))
        )}

        {availableProviders.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {availableProviders.map((provider) => (
              <Button
                key={provider}
                loading={linkingProvider === provider}
                onClick={() => handleLink(provider)}
                size="small"
              >
                + 关联 {getProviderLabel(provider)}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </SettingRow>
  )
}
