'use client'

import AuthIcons from '@/components/AuthIcons'
import {
  ActionIcon,
  DropdownMenu,
  Flexbox,
  Text,
  type MenuProps,
} from '@lobehub/ui'
import { App, Modal } from 'antd'
import { ArrowRight, Plus, Unlink } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  BUILTIN_BETTER_AUTH_PROVIDERS,
  SSO_PROVIDER_LABELS,
} from '@/libs/better-auth/shared'
import { linkSocial, listAccounts, oauth2, unlinkAccount, useAuthConfig } from '@/libs/better-auth/client'

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
  const { message } = App.useApp()
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
  }, [message])

  useEffect(() => {
    loadAccounts()
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

  const allowUnlink =
    oauthAccounts.length > 1 || accounts.some((item) => item.providerId === 'credential')

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

  const confirmUnlink = (account: LinkedAccount) => {
    if (!allowUnlink) {
      message.warning('至少需要保留一种登录方式')
      return
    }

    Modal.confirm({
      content: `确定要解绑 ${getProviderLabel(account.providerId)} 账户吗？`,
      okButtonProps: { danger: true },
      okText: '解绑',
      onOk: () => handleUnlink(account),
      title: '解绑账户',
    })
  }

  const handleUnlink = async (account: LinkedAccount) => {
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

  const linkMenuItems: MenuProps['items'] = availableProviders.map((provider) => ({
    icon: AuthIcons(provider, 16),
    key: provider,
    label: getProviderLabel(provider),
    onClick: () => {
      handleLink(provider)
    },
  }))

  return (
    <SettingRow label="已关联的账户">
      <Flexbox gap={8} style={{ width: '100%' }}>
        {loading ? (
          <Text type="secondary">加载中…</Text>
        ) : oauthAccounts.length === 0 ? (
          <Text type="secondary">暂无关联的第三方账户</Text>
        ) : (
          oauthAccounts.map((account) => (
            <Flexbox
              align="center"
              gap={8}
              horizontal
              justify="space-between"
              key={account.id}
            >
              <Flexbox align="center" gap={6} horizontal style={{ fontSize: 12, minWidth: 0 }}>
                {AuthIcons(account.providerId, 16)}
                <span>{getProviderLabel(account.providerId)}</span>
                {userEmail ? (
                  <Text fontSize={11} type="secondary">
                    · {userEmail}
                  </Text>
                ) : null}
              </Flexbox>
              <ActionIcon
                disabled={!allowUnlink || unlinkingId === account.id}
                icon={Unlink}
                onClick={() => confirmUnlink(account)}
                size="small"
              />
            </Flexbox>
          ))
        )}

        {availableProviders.length > 0 ? (
          <DropdownMenu
            items={linkMenuItems}
            popupProps={{ style: { maxWidth: 200 } }}
          >
            <Flexbox
              align="center"
              gap={6}
              horizontal
              style={{
                cursor: linkingProvider ? 'wait' : 'pointer',
                fontSize: 12,
                opacity: linkingProvider ? 0.6 : 1,
              }}
            >
              <Plus size={14} />
              <span>关联账户</span>
              <ArrowRight size={14} />
            </Flexbox>
          </DropdownMenu>
        ) : null}
      </Flexbox>
    </SettingRow>
  )
}
