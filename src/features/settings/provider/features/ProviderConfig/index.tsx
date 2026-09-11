'use client'

import { Flex, Input, InputPassword, ProviderCombine, Text } from '@pure/ui'
import { Switch } from 'antd'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FocusEvent, FormEvent } from 'react'

import { useApp } from '@/components/AntdStaticMethods'

import { getSettingsProviderMeta, isServerManagedProvider, PROVIDER_DEFAULT_BASE_URLS } from '../../const'
import { saveProviderSecret, secretForProvider, useProviderSecrets } from '../../secretsApi'
import { useProviderConfigStore } from '../../store/useProviderConfigStore'
import { providerDetailStyles as styles } from '../../styles'
import type { ProviderId } from '../../types'
import Checker from './Checker'

interface ProviderConfigProps {
  id: ProviderId
}

const AES_GCM_HINT = '你的密钥与代理地址等将使用 AES-GCM 加密算法进行加密'

const isByokProvider = (id: ProviderId): id is 'openai' | 'deepseek' => id === 'openai' || id === 'deepseek'

const readInputValue = (root: HTMLElement | null) => root?.querySelector('input')?.value.trim() ?? ''

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
          message.success('已加密保存到账号')
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

  const resolveApiKey = () => {
    const fromDom = readInputValue(apiKeyWrapRef.current)
    const next = fromDom || apiKeyDraft.trim()
    if (fromDom && fromDom !== apiKeyDraft) setApiKeyDraft(fromDom)
    return next
  }

  const handleApiKeyBlur = (event: FocusEvent<HTMLInputElement>) => {
    const next = event.relatedTarget
    if (next instanceof Node && apiKeyWrapRef.current?.contains(next)) return
    const apiKey = resolveApiKey()
    if (!apiKey) {
      setApiKeyDraft(savedApiKey)
      return
    }
    if (apiKey === savedApiKey) return
    void persistSecrets({ apiKey, baseURL })
  }

  const handleBaseURLBlur = () => {
    if ((saved?.baseURL ?? '') === baseURL) return
    const apiKey = resolveApiKey()
    if (!saved && !apiKey) {
      message.info('请先填写 API Key，离开输入框后会自动保存')
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
    draftDirtyRef.current = true
    setApiKeyDraft(event.target.value)
  }

  const handleApiKeyInput = (event: FormEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return
    draftDirtyRef.current = true
    setApiKeyDraft(target.value)
  }

  return (
    <Flex className='flex-col gap-2 w-full'>
      <Flex className='flex-between py-2 w-full'>
        <ProviderCombine provider={id} size={32} />
        {serverManaged ? null : (
          <Switch
            aria-label={`${enabled ? '停用' : '启用'} ${meta.name}`}
            checked={enabled}
            onChange={(checked) => setEnabled(id, checked)}
          />
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
                  visibilityToggle={{ onVisibleChange: setKeyVisible, visible: keyVisible }}
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
                disabled={saving}
                placeholder={PROVIDER_DEFAULT_BASE_URLS[id]}
                value={baseURL}
                onBlur={handleBaseURLBlur}
                onChange={(event) => patchConfig(id, { baseURL: event.target.value })}
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
              <Checker ensureSecret={ensureSecretForCheck} provider={id} />
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
