'use client'

import { CheckCircleFilled } from '@ant-design/icons'
import { Highlighter, ModelIcon } from '@pure/ui'
import { Alert, Flex, Button, Select } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo, useEffect, useMemo, useState } from 'react'

import { useProviderConfigStore } from '../../store/useProviderConfigStore'
import { type ProviderId } from '../../types'

const styles = createStaticStyles(({ css }) => ({
  popup: css`
    min-width: 280px;
  `,
}))

interface CheckerProps {
  provider: ProviderId
}

const Checker = memo<CheckerProps>(({ provider }) => {
  const config = useProviderConfigStore((s) => s.configs[provider])
  const setCheckModel = useProviderConfigStore((s) => s.setCheckModel)

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
    setPass(false)
    setError(undefined)
    setLoading(true)

    try {
      const apiKey = config?.apiKey.trim() ?? ''
      const baseURL = config?.baseURL.trim() ?? ''
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`

      const response = await fetch('/api/providers/check', {
        body: JSON.stringify({
          baseURL: baseURL || undefined,
          model: checkModel,
          provider,
        }),
        headers,
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
          body: json.error?.body ?? json,
          message:
            json.error?.message ||
            json.cause ||
            json.message ||
            '连通性检查失败',
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
    <Flex vertical gap={8} style={{ width: '100%' }}>
      <Flex gap={8} style={{ width: '100%' }}>
        <Select
          className={styles.popup}
          options={sortedModelIds.map((id) => ({
            label: (
              <Flex align='center' gap={6}>
                <ModelIcon model={id} size={20} />
                {id}
              </Flex>
            ),
            value: id,
          }))}
          style={{ flex: 1, minWidth: 0 }}
          value={checkModel || undefined}
          onChange={(value) => {
            setLocalCheckModel(value)
            setCheckModel(provider, value)
            setPass(false)
            setError(undefined)
          }}
        />
        <Button
          icon={
            pass ? (
              <CheckCircleFilled style={{ color: cssVar.colorSuccess }} />
            ) : undefined
          }
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
          type='error'
          message={error.message}
          action={
            error.body ? (
              <Flex vertical style={{ paddingBlock: 8, paddingInline: 16 }}>
                <Highlighter
                  actionIconSize='small'
                  language='json'
                  variant='borderless'
                  wrap
                >
                  {JSON.stringify(error.body, null, 2)}
                </Highlighter>
              </Flex>
            ) : undefined
          }
        />
      ) : null}
    </Flex>
  )
})

Checker.displayName = 'ProviderChecker'

export default Checker
