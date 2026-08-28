'use client'

import { DEFAULT_MODEL_PROVIDER_LIST, getAiModel } from '@pure/model-bank'
import { ActionIcon, confirmModal, Flex, SortableList, Tabs } from '@pure/ui'
import { useApp } from '@/components/AntdStaticMethods'
import { apiFetch } from '@/utils/apiFetch'
import { createStaticStyles, cssVar } from 'antd-style'
import { ArrowDownUp, Eye, EyeOff } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useProviderConfigStore } from '../../store/useProviderConfigStore'
import { getSettingsProviderMeta, isServerManagedProvider } from '../../const'
import type { ProviderId, ProviderModelItem } from '../../types'
import EmptyModels from './EmptyModels'
import CustomModelModal from './CustomModelModal'
import type { CustomModelFormValues } from './CustomModelModal'
import HealthCheckModal from './HealthCheckModal'
import { DEFAULT_HEALTH_CHECK_CONCURRENCY, runWithConcurrency } from './healthCheck'
import ModelItem from './ModelItem'
import ModelTitle from './ModelTitle'

type ModelTab = 'all' | 'chat'

interface ModelListProps {
  id: ProviderId
}

const ModelList = memo<ModelListProps>(({ id }) => {
  const { message } = useApp()
  const config = useProviderConfigStore((s) => s.configs[id])
  const addCustomModel = useProviderConfigStore((s) => s.addCustomModel)
  const clearRemoteModels = useProviderConfigStore((s) => s.clearRemoteModels)
  const mergeRemoteModels = useProviderConfigStore((s) => s.mergeRemoteModels)
  const removeCustomModel = useProviderConfigStore((s) => s.removeCustomModel)
  const reorderModels = useProviderConfigStore((s) => s.reorderModels)
  const resetModels = useProviderConfigStore((s) => s.resetModels)
  const setAllModelsEnabled = useProviderConfigStore((s) => s.setAllModelsEnabled)
  const setModelHealth = useProviderConfigStore((s) => s.setModelHealth)
  const updateCustomModel = useProviderConfigStore((s) => s.updateCustomModel)

  const [keyword, setKeyword] = useState('')
  const [tab, setTab] = useState<ModelTab>('all')
  const [loading, setLoading] = useState(false)
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthModalOpen, setHealthModalOpen] = useState(false)
  const [customModelModalOpen, setCustomModelModalOpen] = useState(false)
  const [editingCustomModel, setEditingCustomModel] = useState<ProviderModelItem>()
  const [sortMode, setSortMode] = useState(false)
  const healthAbortRef = useRef<AbortController | null>(null)
  const healthModelIdsRef = useRef<string[]>([])
  const healthRunIdRef = useRef(0)

  const showModelFetcher =
    DEFAULT_MODEL_PROVIDER_LIST.find((provider) => provider.id === id)?.settings?.showModelFetcher !== false
  const canManageCustomModels = !isServerManagedProvider(id)

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
  const remoteModelCount = useMemo(() => models.filter((model) => model.source === 'remote').length, [models])

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

  const handleSaveCustomModel = useCallback(
    (model: CustomModelFormValues) => {
      if (!canManageCustomModels) return

      if (editingCustomModel) {
        updateCustomModel(id, editingCustomModel.id, model)
      } else {
        addCustomModel(id, model)
      }
      setCustomModelModalOpen(false)
      setEditingCustomModel(undefined)
      message.success(editingCustomModel ? `已更新模型 ${model.displayName}` : `已添加模型 ${model.displayName}`)
    },
    [addCustomModel, canManageCustomModels, editingCustomModel, id, message, updateCustomModel]
  )

  const handleOpenAddCustomModel = useCallback(() => {
    if (!canManageCustomModels) return

    setEditingCustomModel(undefined)
    setCustomModelModalOpen(true)
  }, [canManageCustomModels])

  const handleEditCustomModel = useCallback((model: ProviderModelItem) => {
    setEditingCustomModel(model)
    setCustomModelModalOpen(true)
  }, [])

  const handleDeleteCustomModel = useCallback(
    (model: ProviderModelItem) => {
      if (model.source !== 'custom') return
      confirmModal({
        cancelText: '取消',
        content: `确定删除自定义模型「${model.displayName}」吗？删除后不可恢复。`,
        okButtonProps: { danger: true },
        okText: '删除',
        title: '删除自定义模型？',
        onOk: () => {
          removeCustomModel(id, model.id)
          message.success(`已删除模型 ${model.displayName}`)
        },
      })
    },
    [id, message, removeCustomModel]
  )

  const clearCheckingHealth = useCallback(
    (modelIds: string[]) => {
      const currentConfig = useProviderConfigStore.getState().configs[id]
      for (const modelId of modelIds) {
        const model = currentConfig?.models.find((item) => item.id === modelId)
        if (model?.health?.status === 'checking') {
          setModelHealth(id, modelId, { status: 'idle' })
        }
      }
    },
    [id, setModelHealth]
  )

  const cancelHealthCheck = useCallback(
    (notify = true) => {
      const modelIds = healthModelIdsRef.current
      healthRunIdRef.current += 1
      healthAbortRef.current?.abort()
      healthAbortRef.current = null
      healthModelIdsRef.current = []
      clearCheckingHealth(modelIds)
      setHealthLoading(false)
      setHealthModalOpen(false)
      if (notify) message.info('模型健康检查已取消')
    },
    [clearCheckingHealth, message]
  )

  useEffect(() => () => cancelHealthCheck(false), [cancelHealthCheck])

  const handleClearRemoteModels = useCallback(() => {
    if (remoteModelCount === 0) return
    confirmModal({
      cancelText: '取消',
      content: `将移除当前服务商获取的 ${remoteModelCount} 个模型，自定义模型和内置模型会保留。`,
      okButtonProps: { danger: true },
      okText: '清除',
      title: '清除获取的模型？',
      onOk: () => {
        clearRemoteModels(id)
        message.success('已清除获取的模型')
      },
    })
  }, [clearRemoteModels, id, message, remoteModelCount])

  const handleResetModels = useCallback(() => {
    if (!canManageCustomModels) return

    confirmModal({
      cancelText: '取消',
      content: '模型启用状态、自定义模型、获取的模型和排序都会恢复为默认设置。',
      okButtonProps: { danger: true },
      okText: '重置',
      title: '重置所有模型修改？',
      onOk: () => {
        if (healthLoading) cancelHealthCheck(false)
        resetModels(id)
        setKeyword('')
        message.success('已重置所有模型修改')
      },
    })
  }, [canManageCustomModels, cancelHealthCheck, healthLoading, id, message, resetModels])

  const handleSetAllModelsEnabled = useCallback(
    (enabled: boolean) => {
      setAllModelsEnabled(id, enabled)
      message.success(enabled ? '已全部启用模型' : '已全部禁用模型')
    },
    [id, message, setAllModelsEnabled]
  )

  const renderSortableModels = useCallback(
    (items: typeof models) => (
      <SortableList
        gap={4}
        items={items}
        renderItem={(model) => (
          <SortableList.Item id={model.id} width='100%'>
            <ModelItem
              model={model}
              provider={id}
              showDragHandle={sortMode}
              onDeleteCustomModel={handleDeleteCustomModel}
              onEditCustomModel={handleEditCustomModel}
            />
          </SortableList.Item>
        )}
        width='100%'
        onChange={(nextItems) =>
          reorderModels(
            id,
            nextItems.map((model) => model.id)
          )
        }
      />
    ),
    [handleDeleteCustomModel, handleEditCustomModel, id, reorderModels, sortMode]
  )

  const runHealthCheck = async (timeoutMs: number, concurrency: number) => {
    if (healthLoading) return

    setHealthModalOpen(false)
    setHealthLoading(true)

    const controller = new AbortController()
    const runId = healthRunIdRef.current + 1
    healthRunIdRef.current = runId
    healthAbortRef.current = controller
    healthModelIdsRef.current = enabledHealthModels.map((model) => model.id)
    const isCurrentRun = () => healthRunIdRef.current === runId && !controller.signal.aborted

    let successCount = 0
    let failureCount = 0
    const apiKey = config?.apiKey.trim() ?? ''
    const baseURL = config?.baseURL.trim() ?? ''

    await runWithConcurrency(
      enabledHealthModels,
      async (model) => {
        if (!isCurrentRun()) return
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
            signal: controller.signal,
          })
          const json = (await response.json()) as {
            durationMs?: number
            error?: { message?: string }
            cause?: string
            message?: string
            ok?: boolean
          }

          if (!isCurrentRun()) return

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
          if (!isCurrentRun()) return

          failureCount += 1
          setModelHealth(id, model.id, {
            checkedAt: new Date().toISOString(),
            message: error instanceof Error ? error.message : '检查失败',
            status: 'failure',
          })
        }
      },
      concurrency || DEFAULT_HEALTH_CHECK_CONCURRENCY,
      controller.signal
    )

    if (!isCurrentRun()) return

    healthAbortRef.current = null
    healthModelIdsRef.current = []
    setHealthLoading(false)
    message.info(`${getSettingsProviderMeta(id).name}：成功 ${successCount} 个，失败 ${failureCount} 个`)
  }

  return (
    <Flex className='flex-col gap-2 w-full'>
      <ModelTitle
        canClearRemoteModels={remoteModelCount > 0}
        healthLoading={healthLoading}
        healthModelCount={enabledHealthModels.length}
        loading={loading}
        onAddCustomModel={canManageCustomModels ? handleOpenAddCustomModel : undefined}
        searchKeyword={keyword}
        showModelFetcher={showModelFetcher}
        onCancelHealthCheck={() => cancelHealthCheck()}
        onClearRemoteModels={handleClearRemoteModels}
        onHealthCheck={() => setHealthModalOpen(true)}
        onFetch={handleFetch}
        onKeywordChange={setKeyword}
        onResetModels={canManageCustomModels ? handleResetModels : undefined}
      />

      <CustomModelModal
        existingModelIds={models.filter((item) => item.id !== editingCustomModel?.id).map((model) => model.id)}
        model={editingCustomModel}
        open={customModelModalOpen}
        onSave={handleSaveCustomModel}
        onCancel={() => {
          setCustomModelModalOpen(false)
          setEditingCustomModel(undefined)
        }}
      />

      <HealthCheckModal
        enabledModelCount={enabledHealthModels.length}
        loading={healthLoading}
        open={healthModalOpen}
        provider={id}
        onCancel={() => setHealthModalOpen(false)}
        onStart={(timeoutMs, concurrency) => void runHealthCheck(timeoutMs, concurrency)}
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
        <Flex className='flex-col gap-1 w-full'>
          {enabledModels.length > 0 ? (
            <>
              <ModelSectionHeader
                actionIcon={EyeOff}
                actionTitle='全部禁用'
                sortMode={sortMode}
                title='已启用'
                onAction={() => handleSetAllModelsEnabled(false)}
                onToggleSort={() => setSortMode((current) => !current)}
              />
              {renderSortableModels(enabledModels)}
            </>
          ) : null}

          {disabledModels.length > 0 ? (
            <>
              <ModelSectionHeader
                actionIcon={Eye}
                actionTitle='全部启用'
                onToggleSort={enabledModels.length === 0 ? () => setSortMode((current) => !current) : undefined}
                title='未启用'
                onAction={() => handleSetAllModelsEnabled(true)}
              />
              {renderSortableModels(disabledModels)}
            </>
          ) : null}
        </Flex>
      )}
    </Flex>
  )
})

ModelList.displayName = 'ModelList'

interface ModelSectionHeaderProps {
  actionIcon: typeof Eye
  actionTitle: string
  sortMode?: boolean
  title: string
  onAction: () => void
  onToggleSort?: () => void
}

// 保留 createStaticStyles：完整的 Tailwind className 会超过 120 字符，且颜色来自 antd 主题。
const styles = createStaticStyles(({ css }) => ({
  sectionHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px;
    color: ${cssVar.colorTextSecondary};
    font-size: 12px;
    font-weight: 500;
  `,
}))

const ModelSectionHeader = memo<ModelSectionHeaderProps>(
  ({ actionIcon, actionTitle, onAction, onToggleSort, sortMode = false, title }) => (
    <div className={styles.sectionHeader}>
      <span>{title}</span>
      <div className='flex items-center gap-1'>
        {onToggleSort ? (
          <ActionIcon
            active={sortMode}
            icon={ArrowDownUp}
            size='small'
            title={sortMode ? '完成自定义排序' : '自定义排序'}
            onClick={onToggleSort}
          />
        ) : null}
        <ActionIcon icon={actionIcon} size='small' title={actionTitle} onClick={onAction} />
      </div>
    </div>
  )
)

ModelSectionHeader.displayName = 'ModelSectionHeader'

export default ModelList
