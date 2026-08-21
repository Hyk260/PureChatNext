'use client'

import { DEFAULT_MODEL_PROVIDER_LIST, getAiModel } from '@pure/model-bank'
import { Flexbox, Tabs, Text } from '@pure/ui'
import { useApp } from '@/components/AntdStaticMethods'
import { apiFetch } from '@/utils/apiFetch'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo, useMemo, useState } from 'react'

import { useProviderConfigStore } from '../../store/useProviderConfigStore'
import { getSettingsProviderMeta } from '../../const'
import type { ProviderId } from '../../types'
import EmptyModels from './EmptyModels'
import HealthCheckModal from './HealthCheckModal'
import ModelItem from './ModelItem'
import ModelTitle from './ModelTitle'

const styles = createStaticStyles(({ css }) => ({
  sectionLabel: css`
    padding-block: 8px;
    padding-inline: 8px;
    color: ${cssVar.colorTextSecondary};
    font-size: 12px;
    font-weight: 500;
  `,
}))

type ModelTab = 'all' | 'chat'

interface ModelListProps {
  id: ProviderId
}

const HEALTH_CHECK_CONCURRENCY = 4

const runWithConcurrency = async <T,>(items: T[], worker: (item: T) => Promise<void>) => {
  let nextIndex = 0
  const workerCount = Math.min(HEALTH_CHECK_CONCURRENCY, items.length)

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex++]
        if (item) await worker(item)
      }
    })
  )
}

const ModelList = memo<ModelListProps>(({ id }) => {
  const { message } = useApp()
  const config = useProviderConfigStore((s) => s.configs[id])
  const mergeRemoteModels = useProviderConfigStore((s) => s.mergeRemoteModels)
  const setModelHealth = useProviderConfigStore((s) => s.setModelHealth)

  const [keyword, setKeyword] = useState('')
  const [tab, setTab] = useState<ModelTab>('all')
  const [loading, setLoading] = useState(false)
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthModalOpen, setHealthModalOpen] = useState(false)

  const showModelFetcher =
    DEFAULT_MODEL_PROVIDER_LIST.find((provider) => provider.id === id)?.settings?.showModelFetcher !== false

  const models = useMemo(() => config?.models ?? [], [config?.models])

  const filteredModels = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    // All current providers only expose chat models; keep a single tab for now.
    const list = models.filter((model) => getAiModel(id, model.id)?.enabled !== false)

    if (!query) return list

    return list.filter(
      (model) => model.displayName.toLowerCase().includes(query) || model.id.toLowerCase().includes(query)
    )
  }, [id, keyword, models])

  const enabledModels = filteredModels.filter((model) => model.enabled)
  const disabledModels = filteredModels.filter((model) => !model.enabled)
  const enabledHealthModels = useMemo(
    () => models.filter((model) => model.enabled && getAiModel(id, model.id)?.enabled !== false),
    [id, models]
  )

  const fetchRemoteModels = async () => {
    if (!showModelFetcher) return

    setLoading(true)
    try {
      const apiKey = config?.apiKey.trim() ?? ''
      const baseURL = config?.baseURL.trim() ?? ''
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`

      const response = await fetch('/api/providers/models', {
        body: JSON.stringify({
          baseURL: baseURL || undefined,
          provider: id,
        }),
        headers,
        method: 'POST',
      })

      const json = (await response.json()) as {
        cause?: string
        fallback?: boolean
        message?: string
        models?: Array<{ displayName?: string; id: string }>
      }

      if (!response.ok) {
        message.error(json.cause || json.message || '获取模型列表失败')
        return
      }

      const remoteModels = Array.isArray(json.models) ? json.models : []
      mergeRemoteModels(id, remoteModels)

      if (json.fallback) {
        message.warning(json.message || '远程拉取失败，已使用内置模型列表')
      } else {
        message.success(`已获取 ${remoteModels.length} 个模型`)
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '获取模型列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleFetch = showModelFetcher ? () => void fetchRemoteModels() : undefined

  const runHealthCheck = async (timeoutMs: number) => {
    setHealthModalOpen(false)
    setHealthLoading(true)

    let successCount = 0
    let failureCount = 0
    const apiKey = config?.apiKey.trim() ?? ''
    const baseURL = config?.baseURL.trim() ?? ''

    await runWithConcurrency(enabledHealthModels, async (model) => {
      setModelHealth(id, model.id, { status: 'checking' })

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`

        const response = await apiFetch('/api/providers/check', {
          body: JSON.stringify({
            baseURL: baseURL || undefined,
            model: model.id,
            provider: id,
            timeoutMs,
          }),
          headers,
          method: 'POST',
        })
        const json = (await response.json()) as {
          durationMs?: number
          error?: { message?: string }
          cause?: string
          message?: string
          ok?: boolean
        }

        if (!response.ok || !json.ok) {
          failureCount += 1
          setModelHealth(id, model.id, {
            checkedAt: new Date().toISOString(),
            message: json.error?.message || json.cause || json.message || '检查失败',
            status: 'failure',
          })
          return
        }

        successCount += 1
        setModelHealth(id, model.id, {
          checkedAt: new Date().toISOString(),
          durationMs: json.durationMs,
          message: '检查成功',
          status: 'success',
        })
      } catch (error) {
        failureCount += 1
        setModelHealth(id, model.id, {
          checkedAt: new Date().toISOString(),
          message: error instanceof Error ? error.message : '检查失败',
          status: 'failure',
        })
      }
    })

    setHealthLoading(false)
    message.info(`${getSettingsProviderMeta(id).name}：成功 ${successCount} 个，失败 ${failureCount} 个`)
  }

  return (
    <Flexbox gap={8} width='100%'>
      <ModelTitle
        healthLoading={healthLoading}
        healthModelCount={enabledHealthModels.length}
        loading={loading}
        searchKeyword={keyword}
        showModelFetcher={showModelFetcher}
        total={models.length}
        onHealthCheck={() => setHealthModalOpen(true)}
        onFetch={handleFetch}
        onKeywordChange={setKeyword}
      />

      <HealthCheckModal
        enabledModelCount={enabledHealthModels.length}
        loading={healthLoading}
        open={healthModalOpen}
        provider={id}
        onCancel={() => setHealthModalOpen(false)}
        onStart={(timeoutMs) => void runHealthCheck(timeoutMs)}
      />

      <Tabs
        activeKey={tab}
        items={[
          { key: 'all', label: `全部 (${models.length})` },
          { key: 'chat', label: `对话 (${models.length})` },
        ]}
        onChange={(key) => setTab(key as ModelTab)}
      />

      {filteredModels.length === 0 ? (
        <EmptyModels loading={loading} onFetch={handleFetch} />
      ) : (
        <Flexbox gap={4} width='100%'>
          {enabledModels.length > 0 ? (
            <>
              <div className={styles.sectionLabel}>已启用</div>
              {enabledModels.map((model) => (
                <ModelItem key={model.id} model={model} provider={id} />
              ))}
            </>
          ) : null}

          {disabledModels.length > 0 ? (
            <>
              <div className={styles.sectionLabel}>
                <Text type='secondary'>未启用</Text>
              </div>
              {disabledModels.map((model) => (
                <ModelItem key={model.id} model={model} provider={id} />
              ))}
            </>
          ) : null}
        </Flexbox>
      )}
    </Flexbox>
  )
})

ModelList.displayName = 'ModelList'

export default ModelList
