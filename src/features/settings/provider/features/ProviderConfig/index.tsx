'use client'

import { Flex, Input, InputPassword, ProviderCombine, Text } from '@pure/ui'
import { Switch } from 'antd'
import { Loader2 } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FocusEvent, FormEvent } from 'react'

import { useApp } from '@/components/AntdStaticMethods'

import { getSettingsProviderMeta, isServerManagedProvider, PROVIDER_DEFAULT_BASE_URLS } from '../../const'
import { deleteProviderSecret, saveProviderSecret, secretForProvider, useProviderSecrets } from '../../secretsApi'
import { useProviderConfigStore } from '../../store/useProviderConfigStore'
import { providerDetailStyles as styles } from '../../styles'
import type { ProviderId } from '../../types'
import Checker from './Checker'

interface ProviderConfigProps {
  id: ProviderId
}

const AES_GCM_HINT = '你的密钥与代理地址等将使用 AES-GCM 加密算法进行加密'

const isByokProvider = (id: ProviderId): id is 'openai' | 'deepseek' => id === 'openai' || id === 'deepseek'

const ProviderConfig = memo<ProviderConfigProps>(({ id }) => {
  const { message } = useApp()
  const meta = getSettingsProviderMeta(id)
  const config = useProviderConfigStore((s) => s.configs[id])
  const patchConfig = useProviderConfigStore((s) => s.patchConfig)
  const setEnabled = useProviderConfigStore((s) => s.setEnabled)
  const serverManaged = isServerManagedProvider(id)
  const { data: secrets, mutate } = useProviderSecrets()
  const saved = secretForProvider(secrets, id)
  const apiKeyWrapRef = useRef<HTMLDivElement>(null)
  const persistInflightRef = useRef<Promise<boolean> | null>(null)
  const draftDirtyRef = useRef(false)
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [keyVisible, setKeyVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  const enabled = config?.enabled ?? false
  const baseURL = config?.baseURL ?? ''
  const savedApiKey = saved?.apiKey ?? ''

  useEffect(() => {
    draftDirtyRef.current = false
  }, [id])

  useEffect(() => {
    if (serverManaged || draftDirtyRef.current) return
    setApiKeyDraft(savedApiKey)
    setKeyVisible(!savedApiKey)
  }, [id, savedApiKey, serverManaged])

  useEffect(() => {
    if (serverManaged || saved?.baseURL === undefined) return
    patchConfig(id, { baseURL: saved.baseURL })
  }, [id, patchConfig, saved?.baseURL, serverManaged])

  const persistSecrets = useCallback(
    async (next: { apiKey?: string; baseURL?: string }) => {
      if (!isByokProvider(id)) return false
      if (persistInflightRef.current) return persistInflightRef.current

      const run = (async () => {
        setSaving(true)
        try {
          const item = await saveProviderSecret({ ...next, provider: id })
          await mutate(
            (current) => {
              const rest = (current ?? []).filter((entry) => entry.providerId !== id)
              return [...rest, item]
            },
            { revalidate: false }
          )
          if (item.apiKey) {
            setApiKeyDraft(item.apiKey)
            setKeyVisible(false)
          }
          draftDirtyRef.current = false
          patchConfig(id, { baseURL: item.baseURL })
          return true
        } catch (error) {
          message.error(error instanceof Error ? error.message : '保存失败')
          return false
        } finally {
          setSaving(false)
        }
      })()

      persistInflightRef.current = run
      try {
        return await run
      } finally {
        if (persistInflightRef.current === run) persistInflightRef.current = null
      }
    },
    [id, message, mutate, patchConfig]
  )

  const clearSecrets = useCallback(async () => {
    if (!isByokProvider(id)) return false
    if (persistInflightRef.current) return persistInflightRef.current

    const run = (async () => {
      setSaving(true)
      try {
        await deleteProviderSecret(id)
        await mutate((current) => (current ?? []).filter((entry) => entry.providerId !== id), { revalidate: false })
        setApiKeyDraft('')
        setKeyVisible(true)
        draftDirtyRef.current = false
        return true
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除密钥失败')
        setApiKeyDraft(savedApiKey)
        return false
      } finally {
        setSaving(false)
      }
    })()

    persistInflightRef.current = run
    try {
      return await run
    } finally {
      if (persistInflightRef.current === run) persistInflightRef.current = null
    }
  }, [id, message, mutate, savedApiKey])

  const resolveApiKey = () => {
    const input = apiKeyWrapRef.current?.querySelector('input')
    if (input) {
      const fromDom = input.value.trim()
      if (fromDom !== apiKeyDraft) setApiKeyDraft(fromDom)
      return fromDom
    }
    return apiKeyDraft.trim()
  }

  const handleApiKeyBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (saving) return
    const next = event.relatedTarget
    if (next instanceof Node && apiKeyWrapRef.current?.contains(next)) return
    const apiKey = resolveApiKey()
    if (!apiKey) {
      if (!savedApiKey) {
        setApiKeyDraft('')
        return
      }
      void clearSecrets()
      return
    }
    if (apiKey === savedApiKey) return
    void persistSecrets({ apiKey, baseURL })
  }

  const handleBaseURLBlur = () => {
    if (saving) return
    if ((saved?.baseURL ?? '') === baseURL) return
    const apiKey = resolveApiKey()
    if (!saved && !apiKey) {
      message.info('请先填写 API Key')
      return
    }
    void persistSecrets({ apiKey: apiKey || undefined, baseURL })
  }

  const ensureSecretForCheck = () => {
    const apiKey = resolveApiKey()
    if (apiKey && apiKey !== savedApiKey) return persistSecrets({ apiKey, baseURL })
    return Promise.resolve(Boolean(savedApiKey || apiKey))
  }

  const handleApiKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (saving) return
    draftDirtyRef.current = true
    setApiKeyDraft(event.target.value)
  }

  const handleApiKeyInput = (event: FormEvent<HTMLDivElement>) => {
    if (saving) return
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return
    draftDirtyRef.current = true
    setApiKeyDraft(target.value)
  }

  const savingStatus = saving ? (
    <Flex className='items-center gap-1 text-muted-foreground'>
      <Loader2 aria-hidden className='h-4 w-4 animate-spin' />
      <Text type='secondary' style={{ fontSize: 12 }}>
        保存中
      </Text>
    </Flex>
  ) : null

  return (
    <Flex aria-busy={saving} className='flex-col gap-2 w-full'>
      <Flex className='flex-between py-2 w-full'>
        <ProviderCombine provider={id} size={32} />
        {serverManaged ? null : (
          <Flex className='items-center gap-2'>
            {savingStatus}
            <Switch
              aria-label={`${enabled ? '停用' : '启用'} ${meta.name}`}
              checked={enabled}
              disabled={saving}
              onChange={(checked) => setEnabled(id, checked)}
            />
          </Flex>
        )}
      </Flex>

      {serverManaged ? (
        <>
          <Text type='secondary' style={{ fontSize: 13 }}>
            由 PureChat 官方托管，无需填写 API Key。用量计入每月免费积分；用尽后可等待下月重置，或改用下方自配服务商。
          </Text>
          <Text className={styles.hint} style={{ marginBlockStart: 8 }}>
            设置中不提供购买积分入口。
          </Text>
        </>
      ) : (
        <>
          <div className={styles.row}>
            <Flex className={[styles.rowLabel, 'flex-col gap-1']}>
              <Text style={{ fontWeight: 500 }}>API Key</Text>
              <Text type='secondary' style={{ fontSize: 12 }}>
                请填写你的 {meta.name} API Key
              </Text>
            </Flex>
            <div className={styles.rowBody}>
              <div ref={apiKeyWrapRef} className='w-full' onInput={handleApiKeyInput}>
                <InputPassword
                  autoComplete='off'
                  disabled={saving}
                  placeholder={`${meta.name} API Key`}
                  value={apiKeyDraft}
                  visibilityToggle={{
                    onVisibleChange: (visible) => {
                      if (saving) return
                      setKeyVisible(visible)
                    },
                    visible: keyVisible,
                  }}
                  onBlur={handleApiKeyBlur}
                  onChange={handleApiKeyChange}
                  onPressEnter={(event) => {
                    event.preventDefault()
                    event.currentTarget.blur()
                  }}
                />
              </div>
            </div>
          </div>

          <div className={styles.row}>
            <Flex className={[styles.rowLabel, 'flex-col gap-1']}>
              <Text style={{ fontWeight: 500 }}>API 代理地址</Text>
              <Text type='secondary' style={{ fontSize: 12 }}>
                必须包含 http(s)://
              </Text>
            </Flex>
            <div className={styles.rowBody}>
              <Input
                allowClear
                disabled={saving}
                placeholder={PROVIDER_DEFAULT_BASE_URLS[id]}
                value={baseURL}
                onBlur={handleBaseURLBlur}
                onChange={(event) => {
                  if (saving) return
                  patchConfig(id, { baseURL: event.target.value })
                }}
                onPressEnter={(event) => {
                  event.preventDefault()
                  event.currentTarget.blur()
                }}
              />
            </div>
          </div>

          <div className={styles.row}>
            <Flex className={[styles.rowLabel, 'flex-col gap-1']}>
              <Text style={{ fontWeight: 500 }}>连通性检查</Text>
              <Text type='secondary' style={{ fontSize: 12 }}>
                测试 API Key 与代理地址是否正确填写
              </Text>
            </Flex>
            <div className={styles.rowBody}>
              <Checker disabled={saving} ensureSecret={ensureSecretForCheck} provider={id} />
            </div>
          </div>

          <Text className={styles.hint} style={{ marginBlockStart: 8 }}>
            {AES_GCM_HINT}
          </Text>
        </>
      )}
    </Flex>
  )
})

ProviderConfig.displayName = 'ProviderConfig'

export default ProviderConfig
