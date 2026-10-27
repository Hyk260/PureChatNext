'use client'

import { getErrorMessage } from '@pure/utils/error'

import { toast, Switch } from '@lobehub/ui'
import { ActionIcon, Flex, Input, Text } from '@pure/ui'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FocusEvent, FormEvent } from 'react'

import { getSettingsProviderMeta, isServerManagedProvider, PROVIDER_DEFAULT_BASE_URLS } from '../../const'
import { updateCustomProvider } from '../../customProvidersApi'
import ProviderMark from '../../ProviderMark'
import { deleteProviderSecret, saveProviderSecret, secretForProvider, useProviderSecrets } from '../../secretsApi'
import { useProviderConfigStore } from '../../store/useProviderConfigStore'
import { useCustomProviderRegistry } from '../../useCustomProviderRegistry'
import { providerDetailStyles as styles } from '../../styles'
import type { ProviderId } from '../../types'
import Checker from './Checker'

interface ProviderConfigProps {
  id: ProviderId
}

const isByokProvider = (id: ProviderId) => id !== 'purechat'

const ProviderConfig = memo<ProviderConfigProps>(({ id }) => {
  const registry = useCustomProviderRegistry()
  const storedCustomProviders = useProviderConfigStore((s) => s.customProviders)
  const customProviders = registry.data ?? storedCustomProviders
  const customProvider = customProviders.find((provider) => provider.id === id)
  const meta = getSettingsProviderMeta(id, customProviders)
  const config = useProviderConfigStore((s) => s.configs[id])
  const patchConfig = useProviderConfigStore((s) => s.patchConfig)
  const setEnabled = useProviderConfigStore((s) => s.setEnabled)
  const setCustomProviders = useProviderConfigStore((s) => s.setCustomProviders)
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
  const baseURLPlaceholder = customProvider?.baseURL ?? PROVIDER_DEFAULT_BASE_URLS[id as keyof typeof PROVIDER_DEFAULT_BASE_URLS]
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
    if (serverManaged || customProvider || saved?.baseURL === undefined) return
    patchConfig(id, { baseURL: saved.baseURL })
  }, [customProvider, id, patchConfig, saved?.baseURL, serverManaged])

  const persistSecrets = useCallback(
    async (next: { apiKey?: string; baseURL?: string }) => {
      if (!isByokProvider(id)) return false
      if (persistInflightRef.current) return persistInflightRef.current

      const run = (async () => {
        setSaving(true)
        try {
          const item = await saveProviderSecret({
            ...(customProvider ? { apiKey: next.apiKey } : next),
            provider: id,
          })
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
          if (!customProvider) patchConfig(id, { baseURL: item.baseURL })
          return true
        } catch (error) {
          toast.error(getErrorMessage(error, '保存失败'))
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
    [customProvider, id, mutate, patchConfig]
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
        toast.error(getErrorMessage(error, '删除密钥失败'))
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
  }, [id, mutate, savedApiKey])

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
      clearSecrets()
      return
    }
    if (apiKey === savedApiKey) return
    persistSecrets({ apiKey, baseURL })
  }

  const handleBaseURLBlur = () => {
    if (saving) return
    if (customProvider) {
      if (customProvider.baseURL === baseURL.trim()) return
      setSaving(true)
      updateCustomProvider(id, { baseURL: baseURL.trim() })
        .then((updated) => {
          const nextProviders = customProviders.map((provider) => (provider.id === id ? updated : provider))
          setCustomProviders(nextProviders)
          return registry.mutate(nextProviders, { revalidate: false })
        })
        .catch((error: unknown) => {
          patchConfig(id, { baseURL: customProvider.baseURL })
          toast.error(getErrorMessage(error, '保存代理地址失败'))
        })
        .finally(() => setSaving(false))
      return
    }
    if ((saved?.baseURL ?? '') === baseURL) return
    const apiKey = resolveApiKey()
    if (!saved && !apiKey) {
      toast.info('请先填写 API Key')
      return
    }
    persistSecrets({ apiKey: apiKey || undefined, baseURL })
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
      <Loader2 aria-hidden className='size-4 animate-spin' />
      <Text className='text-[12px]' type='secondary'>
        保存中
      </Text>
    </Flex>
  ) : null

  const handleEnabledChange = (checked: boolean) => {
    setEnabled(id, checked)
    if (!customProvider) return

    setSaving(true)
    updateCustomProvider(id, { enabled: checked })
      .then((updated) => {
        const nextProviders = customProviders.map((provider) => (provider.id === id ? updated : provider))
        setCustomProviders(nextProviders)
        return registry.mutate(nextProviders, { revalidate: false })
      })
      .catch((error: unknown) => {
        setEnabled(id, !checked)
        toast.error(getErrorMessage(error, '更新服务商状态失败'))
      })
      .finally(() => setSaving(false))
  }

  return (
    <Flex aria-busy={saving} className='flex-col gap-2 w-full'>
      <Flex className='flex-between py-2 w-full'>
        <ProviderMark combined id={id} logo={meta.logo} name={meta.name} size={32} />
        {serverManaged ? null : (
          <Flex className='items-center gap-2'>
            {savingStatus}
            <Switch
              aria-label={`${enabled ? '停用' : '启用'} ${meta.name}`}
              checked={enabled}
              disabled={saving}
              onChange={handleEnabledChange}
            />
          </Flex>
        )}
      </Flex>

      {serverManaged ? (
        <>
          <Text className='text-[13px]' type='secondary'>
            由 PureChat 官方托管，无需填写 API Key。用量计入每月免费积分；用尽后可等待下月重置，或改用下方自配服务商。
          </Text>
          <Text className={`${styles.hint} mt-2`}>设置中不提供购买积分入口。</Text>
        </>
      ) : (
        <>
          <div className={styles.row}>
            <Flex className='flex-1 min-w-0 flex-col gap-1'>
              <Text className='font-medium'>API Key</Text>
              <Text className='text-[12px]' type='secondary'>
                请填写你的 {meta.name} API Key
              </Text>
            </Flex>
            <div className={styles.rowBody}>
              <div ref={apiKeyWrapRef} className='w-full' onInput={handleApiKeyInput}>
                <Input
                  autoComplete='off'
                  disabled={saving}
                  placeholder={`${meta.name} API Key`}
                  value={apiKeyDraft}
                  type={keyVisible ? 'text' : 'password'}
                  suffix={
                    <ActionIcon
                      aria-label={keyVisible ? '隐藏 API Key' : '显示 API Key'}
                      disabled={saving}
                      icon={keyVisible ? EyeOff : Eye}
                      size='small'
                      title={keyVisible ? '隐藏 API Key' : '显示 API Key'}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setKeyVisible((visible) => !visible)}
                    />
                  }
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
            <Flex className='flex-1 min-w-0 flex-col gap-1'>
              <Text className='font-medium'>API 代理地址</Text>
              <Text className='text-[12px]' type='secondary'>
                必须包含 http(s)://
              </Text>
            </Flex>
            <div className={styles.rowBody}>
              <Input
                allowClear
                disabled={saving}
                placeholder={baseURLPlaceholder}
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
            <Flex className='flex-1 min-w-0 flex-col gap-1'>
              <Text className='font-medium'>连通性检查</Text>
              <Text className='text-[12px]' type='secondary'>
                测试 API Key 与代理地址是否正确填写
              </Text>
            </Flex>
            <div className={styles.rowBody}>
              <Checker disabled={saving} ensureSecret={ensureSecretForCheck} provider={id} />
            </div>
          </div>

          {/* <Text className={`${styles.hint} mt-2`}>
            {AES_GCM_HINT}
          </Text> */}
        </>
      )}
    </Flex>
  )
})

ProviderConfig.displayName = 'ProviderConfig'

export default ProviderConfig
