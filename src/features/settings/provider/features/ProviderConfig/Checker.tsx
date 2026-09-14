'use client'

import { CheckCircleFilled } from '@ant-design/icons'
import { Alert, Button, Flex, ModelIcon, Select } from '@pure/ui'
import { Highlighter } from '@pure/ui/Markdown'
import { useApp } from '@/components/AntdStaticMethods'
import { DEFAULT_PROVIDER_CHECK_TIMEOUT_MS } from '@/libs/ai-providers/checkTimeout'
import { apiFetch } from '@/utils/apiFetch'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo, useEffect, useMemo, useState } from 'react'

import { getSettingsProviderMeta } from '../../const'
import { secretForProvider, useProviderSecrets } from '../../secretsApi'
import { useProviderConfigStore } from '../../store/useProviderConfigStore'
import type { ProviderId } from '../../types'

const styles = createStaticStyles(({ css }) => ({
  popup: css`
    min-width: 280px;
  `,
}))

interface CheckerProps {
  disabled?: boolean
  ensureSecret?: () => Promise<boolean>
  provider: ProviderId
}

const Checker = memo<CheckerProps>(({ disabled, ensureSecret, provider }) => {
  const { modal } = useApp()
  const config = useProviderConfigStore((s) => s.configs[provider])
  const setCheckModel = useProviderConfigStore((s) => s.setCheckModel)
  const meta = getSettingsProviderMeta(provider)

  const { data: secrets } = useProviderSecrets()
  const hasVaultKey = Boolean(secretForProvider(secrets, provider))
  const models = useMemo(() => config?.models ?? [], [config?.models])
  const persistedCheckModel = config?.checkModel ?? models[0]?.id ?? ''

  const [loading, setLoading] = useState(false)
  const [pass, setPass] = useState(false)
  const [checkModel, setLocalCheckModel] = useState(persistedCheckModel)
  const [error, setError] = useState<{ body?: unknown; message: string } | undefined>()

  useEffect(() => {
    setLocalCheckModel(persistedCheckModel)
    setPass(false)
    setError(undefined)
  }, [persistedCheckModel, provider])

  const sortedModelIds = useMemo(() => {
    const next = [...models]
    next.sort((a, b) => {
      if (a.id === checkModel) return -1
      if (b.id === checkModel) return 1
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
      return a.id.localeCompare(b.id)
    })
    return next.map((model) => model.id)
  }, [checkModel, models])

  const checkConnection = async () => {
    if (disabled) return
    const hasSavedKey = ensureSecret ? await ensureSecret() : hasVaultKey
    if (!hasSavedKey) {
      modal.error({
        title: '缺少 API Key',
        content: `尚未保存 ${meta.name} API Key。请先填写，离开输入框后会自动保存。`,
      })
      return
    }

    setPass(false)
    setError(undefined)
    setLoading(true)

    try {
      const baseURL = config?.baseURL.trim() ?? ''
      const response = await apiFetch('/api/providers/check', {
        body: JSON.stringify({
          baseURL: baseURL || undefined,
          model: checkModel,
          provider,
          timeoutMs: DEFAULT_PROVIDER_CHECK_TIMEOUT_MS,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })

      const json = (await response.json()) as {
        error?: { body?: unknown; message?: string }
        ok?: boolean
        message?: string
        cause?: string
      }

      if (!response.ok || !json.ok) {
        setPass(false)
        setError({
          body: json.error?.body,
          message: json.error?.message || json.cause || json.message || '连通性检查失败',
        })
        return
      }

      setPass(true)
      setError(undefined)
    } catch (err) {
      setPass(false)
      setError({
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Flex className='flex-col gap-2 w-full'>
      <Flex className='flex-row gap-2 w-full'>
        <Select
          className={styles.popup}
          disabled={disabled}
          options={sortedModelIds.map((id) => ({
            label: (
              <Flex className='flex-row items-center gap-1.5'>
                <ModelIcon model={id} size={20} />
                {id}
              </Flex>
            ),
            value: id,
          }))}
          style={{ flex: 1, minWidth: 0 }}
          value={checkModel || undefined}
          onChange={(value) => {
            if (disabled) return
            setLocalCheckModel(value)
            setCheckModel(provider, value)
            setPass(false)
            setError(undefined)
          }}
        />
        <Button
          disabled={disabled}
          icon={pass ? <CheckCircleFilled style={{ color: cssVar.colorSuccess }} /> : undefined}
          loading={loading}
          style={
            pass
              ? {
                  borderColor: cssVar.colorSuccess,
                  color: cssVar.colorSuccess,
                }
              : undefined
          }
          onClick={() => void checkConnection()}
        >
          {pass ? '检查通过' : '检查'}
        </Button>
      </Flex>

      {error ? (
        <Alert
          showIcon
          className='min-w-0'
          extra={
            error.body == null ? undefined : (
              <Highlighter actionIconSize='small' language='json' padding={8} variant='borderless' wrap>
                {JSON.stringify(error.body, null, 2)}
              </Highlighter>
            )
          }
          title={error.message}
          type='error'
        />
      ) : null}
    </Flex>
  )
})

Checker.displayName = 'ProviderChecker'

export default Checker
