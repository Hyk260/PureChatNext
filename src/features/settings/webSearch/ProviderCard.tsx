import { FETCH_PROVIDER_IDS, SEARCH_PROVIDER_IDS, WEB_PROVIDER_CATALOG } from '@pure/types'
import type {
  WebCapability,
  WebProviderConfig,
  WebProviderId,
  WebSearchSettingsPatch,
  WebSearchSettingsResponse,
} from '@pure/types'
import { ActionIcon, Block, Flex, Input, InputPassword, Select, Text, Tooltip } from '@pure/ui'
import { Activity, CircleHelp, ExternalLink, List } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { useApp } from '@/components/AntdStaticMethods'

import { ApiKeysModal, parseApiKeys } from './ApiKeysModal'
import { checkWebProvider } from './api'

type Draft = {
  apiKeys: string
  baseURL: string
  engineId: string
  basicAuthUsername: string
  basicAuthPassword: string
}
const providerDraft = (config: WebProviderConfig, capability: WebCapability): Draft => ({
  apiKeys: config.apiKeys?.join(', ') ?? '',
  baseURL: config[`${capability}BaseURL`] ?? '',
  engineId: config.engineId ?? '',
  basicAuthUsername: config.basicAuthUsername ?? '',
  basicAuthPassword: config.basicAuthPassword ?? '',
})

export function ProviderCard({
  capability,
  data,
  save,
  children,
}: {
  capability: WebCapability
  data: WebSearchSettingsResponse
  save: (patch: WebSearchSettingsPatch) => Promise<unknown>
  children?: ReactNode
}) {
  const { message } = useApp()
  const selectionKey = capability === 'search' ? 'searchProvider' : 'fetchProvider'
  const selected = data.settings[selectionKey]
  const followingServer = selected == null
  const ids = capability === 'search' ? SEARCH_PROVIDER_IDS : FETCH_PROVIDER_IDS
  const serverIds = capability === 'search' ? data.server.searchProviders : data.server.fetchProviders
  const effectiveId = selected ?? serverIds[0]
  const provider = ids.find((id) => id === effectiveId) ?? ids[0]
  const config = data.settings.providers?.[provider] ?? {}
  const saved = providerDraft(config, capability)
  const [edits, setEdits] = useState<Partial<Draft>>({})
  const draft = { ...saved, ...edits }
  const [keysOpen, setKeysOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkMessage, setCheckMessage] = useState('')
  const dirty = Object.entries(edits).some(([key, value]) => saved[key as keyof Draft] !== value)

  const meta = WEB_PROVIDER_CATALOG[provider]
  const server = data.server.providers[provider]
  const title = capability === 'search' ? '搜索服务商' : 'URL 获取服务商'
  const hasKey = provider !== 'naive' && provider !== 'searxng'
  const serverEndpoint = server?.[`${capability}BaseURL`] || meta[`${capability}BaseURL`] || '服务商默认地址'
  const update = (key: keyof Draft, value: string) => setEdits((current) => ({ ...current, [key]: value }))
  const commit = async (keys?: string[]) => {
    if (!dirty && keys === undefined) return true
    try {
      const patch: WebProviderConfig = {}
      const snapshot = { ...edits }
      const current = saved
      for (const key of Object.keys(draft) as Array<keyof Draft>) {
        if (draft[key] === current[key]) continue
        if (key === 'apiKeys') patch.apiKeys = parseApiKeys(draft.apiKeys)
        else if (key === 'baseURL') patch[`${capability}BaseURL`] = draft.baseURL
        else patch[key] = draft[key]
      }
      if (keys !== undefined) patch.apiKeys = keys
      await save({ providers: { [provider]: patch } })
      setEdits((currentEdits) => {
        const remaining = { ...currentEdits }
        for (const key of Object.keys(snapshot) as Array<keyof Draft>) {
          if (currentEdits[key] === snapshot[key]) delete remaining[key]
        }
        if (keys !== undefined && currentEdits.apiKeys === snapshot.apiKeys) delete remaining.apiKeys
        return remaining
      })
      return true
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败')
      return false
    }
  }
  const select = async (value: string) => {
    if (!(await commit())) return
    try {
      await save({ [selectionKey]: value === 'server' ? null : value })
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败')
    }
  }
  const openKeys = async () => {
    if (await commit()) setKeysOpen(true)
  }
  const check = async () => {
    if (!(await commit())) return
    setChecking(true)
    try {
      const result = await checkWebProvider(capability, provider)
      setCheckMessage(`${result.message} · ${result.durationMs} ms`)
      if (result.success) message.success('连接成功')
      else message.error(result.message)
    } catch (error) {
      setCheckMessage(error instanceof Error ? error.message : '检测失败')
    } finally {
      setChecking(false)
    }
  }
  const blur = () => {
    commit()
  }
  const options = [
    { label: '默认（服务器配置）', value: 'server' },
    ...ids.map((id) => ({ label: WEB_PROVIDER_CATALOG[id].name, value: id })),
  ]
  const endpointPlaceholder = serverEndpoint

  return (
    <Block variant='outlined' className='rounded-2xl p-5 sm:p-6'>
      <Flex className='flex-col gap-5'>
        <Flex className='flex-between-wrap gap-3'>
          <Flex className='min-w-0 flex-1 flex-col gap-1'>
            <Text as='h2' fontSize={17} weight={600}>
              <label htmlFor={`web-${capability}-provider`}>{title}</label>
            </Text>
            <Text type='secondary' fontSize={13}>
              {meta.description}{' '}
              {meta.website && (
                <a href={meta.website} target='_blank' rel='noreferrer' aria-label={`${meta.name} 官网`}>
                  <ExternalLink size={13} className='inline' />
                </a>
              )}
              {followingServer && (
                <Tooltip
                  title={
                    <Flex className='max-w-72 flex-col gap-1'>
                      <Text className='text-xs'>
                        服务器顺序：
                        {serverIds.map((id) => WEB_PROVIDER_CATALOG[id as WebProviderId]?.name ?? id).join(' → ')}
                      </Text>
                      <Text className='text-xs'>当前使用服务器配置的地址：{serverEndpoint}</Text>
                      <Text className='text-xs'>默认配置不使用个人密钥和地址；已保存的个人设置会保留。</Text>
                    </Flex>
                  }
                >
                  <CircleHelp
                    aria-label='服务器配置说明'
                    className='ml-1 inline size-3.5 cursor-help align-[-2px] text-muted-foreground'
                    role='img'
                    tabIndex={0}
                  />
                </Tooltip>
              )}
            </Text>
          </Flex>
          <Flex className='w-full shrink-0 sm:w-[230px]'>
            <Select
              id={`web-${capability}-provider`}
              className='w-full'
              value={selected ?? 'server'}
              options={options}
              onChange={select}
            />
          </Flex>
        </Flex>
        {hasKey && (
          <Flex className='flex-col gap-2 border-t border-app-border-secondary pt-4'>
            <Text weight={500}>
              API 密钥{' '}
              <a className='ml-2 text-xs' href={meta.website} target='_blank' rel='noreferrer'>
                获取密钥
              </a>
            </Text>
            <Flex className='items-center gap-2'>
              <InputPassword
                aria-label={`${title} API 密钥`}
                value={followingServer ? '' : draft.apiKeys}
                disabled={followingServer}
                onChange={(event) => update('apiKeys', event.target.value)}
                onBlur={blur}
                placeholder={
                  followingServer
                    ? '默认（服务器配置），不使用个人 API 密钥'
                    : server?.[capability === 'search' ? 'hasSearchApiKey' : 'hasFetchApiKey']
                      ? '服务器已配置；留空继承，多个密钥用逗号分隔'
                      : 'API 密钥，多个密钥用逗号分隔'
                }
              />
              <ActionIcon
                aria-label='密钥列表'
                icon={List}
                title='密钥列表'
                disabled={followingServer}
                onClick={openKeys}
              />
              <ActionIcon
                aria-label={`检测${title}`}
                icon={Activity}
                title={`检测${title}`}
                loading={checking}
                onClick={check}
              />
            </Flex>
          </Flex>
        )}
        {provider !== 'naive' && (
          <Flex className='flex-col gap-2 border-t border-app-border-secondary pt-4'>
            <Text weight={500}>API 地址</Text>
            <Flex className='items-center gap-2'>
              <Input
                aria-label={`${title} API 地址`}
                value={followingServer ? '' : draft.baseURL}
                disabled={followingServer}
                onChange={(event) => update('baseURL', event.target.value)}
                onBlur={blur}
                placeholder={endpointPlaceholder}
              />
              {!hasKey && (
                <ActionIcon
                  aria-label={`检测${title}`}
                  icon={Activity}
                  title={`检测${title}`}
                  loading={checking}
                  onClick={check}
                />
              )}
            </Flex>
            {!followingServer && (
              <Text type='secondary' fontSize={12}>
                留空继承服务器地址；自定义地址需填写自己的密钥。基础地址保留版本路径，不包含 search、scrape 等操作路径。
              </Text>
            )}
          </Flex>
        )}
        {provider === 'google' && (
          <Flex className='flex-col gap-2'>
            <Text>搜索引擎 ID</Text>
            <Input
              aria-label='Google 搜索引擎 ID'
              value={followingServer ? '' : draft.engineId}
              disabled={followingServer}
              placeholder={server?.engineId || '搜索引擎 ID（cx）'}
              onChange={(event) => update('engineId', event.target.value)}
              onBlur={blur}
            />
          </Flex>
        )}
        {provider === 'searxng' && (
          <Flex className='flex-col gap-2'>
            <Text>Basic Auth（可选）</Text>
            <Input
              aria-label='Basic Auth 用户名'
              value={followingServer ? '' : draft.basicAuthUsername}
              disabled={followingServer}
              placeholder='用户名'
              onChange={(event) => update('basicAuthUsername', event.target.value)}
              onBlur={blur}
            />
            <InputPassword
              aria-label='Basic Auth 密码'
              value={followingServer ? '' : draft.basicAuthPassword}
              disabled={followingServer}
              placeholder='密码'
              onChange={(event) => update('basicAuthPassword', event.target.value)}
              onBlur={blur}
            />
          </Flex>
        )}
        {provider === 'naive' && (
          <ActionIcon
            aria-label='检测 Fetch'
            icon={Activity}
            title='检测 Fetch'
            loading={checking}
            onClick={check}
          />
        )}
        {checkMessage && (
          <Text role='status' type='secondary' fontSize={12}>
            {checkMessage}
          </Text>
        )}
        {children}
      </Flex>
      {keysOpen && (
        <ApiKeysModal keys={parseApiKeys(draft.apiKeys)} onSave={commit} onClose={() => setKeysOpen(false)} />
      )}
    </Block>
  )
}
