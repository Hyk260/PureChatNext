'use client'

import { ActionIcon, Button, Empty, Flex, Icon, ModelIcon, Modal, SearchBar, Tabs, Tag, Text, Tooltip } from '@pure/ui'
import { formatTokenNumber } from '@pure/utils/client'
import { getErrorMessage } from '@pure/utils/error'
import { Checkbox, toast } from '@lobehub/ui'
import { apiFetch, jsonInit } from '@/utils/apiFetch'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Eye,
  Globe2,
  ImageIcon,
  Lightbulb,
  ListPlus,
  ListMinus,
  Loader2,
  Mic,
  Plus,
  Volume2,
  Wrench,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { ModelAbilities } from '@pure/model-bank'
import type { ProviderId, ProviderModelItem } from '../../types'
import { buildModelCatalog, filterModelCatalog, groupModelCatalog, isAudioCatalogModel } from './modelCatalog'
import type { ModelCatalogItem, ModelCatalogTab } from './modelCatalog'

interface ModelCatalogModalProps {
  baseURL: string
  open: boolean
  provider: ProviderId
  providerName: string
  configuredModels: ProviderModelItem[]
  onSave: (models: ModelCatalogItem[], selectedModelIds: ReadonlySet<string>) => void
  onClose: () => void
}

interface ModelCatalogResponse {
  cause?: string
  fallback?: boolean
  message?: string
  models?: Array<{ displayName?: string; id: string }>
}

const CATALOG_TABS: Array<{ key: ModelCatalogTab; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'chat', label: '会话' },
  { key: 'audio', label: '音频' },
]

const CAPABILITY_ITEMS = [
  { color: 'blue', icon: Wrench, key: 'functionCall', label: '支持工具调用' },
  { color: 'geekblue', icon: Eye, key: 'vision', label: '支持视觉输入' },
  { color: 'cyan', icon: Mic, key: 'audioInput', label: '支持音频输入' },
  { color: 'purple', icon: Volume2, key: 'audioOutput', label: '支持音频输出' },
  { color: 'purple', icon: Lightbulb, key: 'reasoning', label: '支持推理能力' },
  { color: 'orange', icon: ImageIcon, key: 'imageGeneration', label: '支持图片生成' },
  { color: 'green', icon: Globe2, key: 'webSearch', label: '支持联网搜索' },
  { color: 'gold', icon: Code2, key: 'structuredOutput', label: '支持结构化输出' },
] as const

const isModelCatalogTab = (key: string): key is ModelCatalogTab => CATALOG_TABS.some((tab) => tab.key === key)

const ModelCatalogModal = ({
  baseURL,
  open,
  provider,
  providerName,
  configuredModels,
  onSave,
  onClose,
}: ModelCatalogModalProps) => {
  const [models, setModels] = useState(() => buildModelCatalog(provider, []))
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [tab, setTab] = useState<ModelCatalogTab>('all')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())
  const [selectedModelIds, setSelectedModelIds] = useState(
    () => new Set(configuredModels.filter((model) => model.enabled).map((model) => model.id))
  )

  useEffect(() => {
    if (!open) return

    const controller = new AbortController()
    const loadModels = async () => {
      try {
        const response = await apiFetch(
          '/api/providers/models',
          jsonInit({ baseURL: baseURL.trim() || undefined, provider }, { method: 'POST', signal: controller.signal })
        )
        const json: ModelCatalogResponse = await response.json()
        if (controller.signal.aborted) return
        if (!response.ok) throw new Error(json.cause || json.message || '获取模型列表失败')

        setModels(buildModelCatalog(provider, Array.isArray(json.models) ? json.models : []))
        if (json.fallback) toast.warning(json.message || '远程拉取失败，已使用内置模型列表')
      } catch (error) {
        if (!controller.signal.aborted) toast.error(getErrorMessage(error, '获取模型列表失败'))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadModels()
    return () => controller.abort()
  }, [baseURL, open, provider])

  const filteredModels = useMemo(() => filterModelCatalog(models, keyword, tab), [models, keyword, tab])
  const groups = useMemo(() => groupModelCatalog(filteredModels, providerName), [filteredModels, providerName])
  const counts = useMemo(
    () => ({
      all: models.length,
      audio: models.filter(isAudioCatalogModel).length,
      chat: models.filter((model) => !isAudioCatalogModel(model)).length,
    }),
    [models]
  )
  const allFilteredSelected =
    filteredModels.length > 0 && filteredModels.every((model) => selectedModelIds.has(model.id))
  const selectedCount = models.filter((model) => selectedModelIds.has(model.id)).length
  const showEmpty = !loading && groups.length === 0
  const showModels = !loading && groups.length > 0

  const setModelSelection = (items: ModelCatalogItem[], selected: boolean) => {
    setSelectedModelIds((current) => {
      const next = new Set(current)
      for (const model of items) {
        if (selected) next.add(model.id)
        else next.delete(model.id)
      }
      return next
    })
  }

  const handleTabChange = (key: string) => {
    if (isModelCatalogTab(key)) setTab(key)
  }

  const handleSave = () => {
    if (loading || models.length === 0) return
    onSave(models, selectedModelIds)
  }

  const handleToggleGroup = (group: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  return (
    <Modal
      cancelText='取消'
      destroyOnHidden
      okButtonProps={{ disabled: loading || models.length === 0 }}
      okText='保存'
      open={open}
      styles={{
        body: {
          display: 'flex',
          flexDirection: 'column',
          height: 'min(72vh, 760px)',
          minHeight: 0,
          overflow: 'hidden',
        },
      }}
      title={
        <Flex className='items-center gap-2'>
          <Text className='text-base font-semibold'>{providerName} 模型</Text>
          <Tag>{models.length}</Tag>
        </Flex>
      }
      width='min(96vw, 1120px)'
      onCancel={onClose}
      onOk={handleSave}
    >
      <Flex className='h-full min-h-0 flex-col gap-3'>
        <Flex className='items-center gap-2'>
          <SearchBar
            className='min-w-0 flex-1'
            disabled={loading}
            placeholder='搜索模型名称或 ID'
            value={keyword}
            onInputChange={setKeyword}
          />
          <Button
            disabled={loading || filteredModels.length === 0}
            icon={allFilteredSelected ? <ListMinus size={16} /> : <ListPlus size={16} />}
            onClick={() => setModelSelection(filteredModels, !allFilteredSelected)}
          >
            {allFilteredSelected ? '取消全选' : '全选模型'}
          </Button>
        </Flex>

        <Tabs
          activeKey={tab}
          items={CATALOG_TABS.map((item) => ({
            disabled: loading,
            key: item.key,
            label: `${item.label} (${counts[item.key]})`,
          }))}
          onChange={handleTabChange}
        />

        {loading ? (
          <Flex aria-live='polite' className='flex-col-center min-h-0 flex-1 gap-3'>
            <Loader2 className='animate-spin' size={24} />
            <Text type='secondary'>正在获取模型列表…</Text>
          </Flex>
        ) : null}
        {showEmpty ? (
          <Flex className='flex-center min-h-0 flex-1'>
            <Empty description='没有匹配的模型' />
          </Flex>
        ) : null}
        {showModels ? (
          <div className='min-h-0 flex-1 overflow-y-auto pr-2'>
            {groups.map(([group, groupModels]) => {
              const collapsed = collapsedGroups.has(group)
              const groupSelected = groupModels.every((model) => selectedModelIds.has(model.id))
              const groupAction = `${groupSelected ? '取消选择' : '选择'} ${group} 分组的全部模型`

              return (
                <section className='mb-2' key={group}>
                  <Flex className='flex-between sticky top-0 z-10 border-b border-border bg-background py-2'>
                    <button
                      aria-expanded={!collapsed}
                      className='flex min-w-0 items-center gap-2 text-left'
                      type='button'
                      onClick={() => handleToggleGroup(group)}
                    >
                      {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      <Text className='truncate font-semibold'>{group}</Text>
                      <Tag>{groupModels.length}</Tag>
                    </button>
                    <Tooltip title={groupAction}>
                      <ActionIcon
                        active={groupSelected}
                        icon={groupSelected ? Check : Plus}
                        size='small'
                        title={groupAction}
                        onClick={() => setModelSelection(groupModels, !groupSelected)}
                      />
                    </Tooltip>
                  </Flex>

                  {!collapsed ? (
                    <Flex className='flex-col'>
                      {groupModels.map((model) => {
                        const selected = selectedModelIds.has(model.id)

                        return (
                          <Flex
                            className='flex-between gap-3 border-b border-border/60 px-2 py-3 last:border-0'
                            key={model.id}
                          >
                            <Flex className='min-w-0 flex-1 items-center gap-3'>
                              <ModelIcon model={model.id} size={32} />
                              <Flex className='min-w-0 flex-1 flex-col gap-1'>
                                <Flex className='min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
                                  <Text className='font-medium' ellipsis>
                                    {model.displayName}
                                  </Text>
                                  <Tag className='max-w-full truncate'>{model.id}</Tag>
                                  <ModelCatalogTags
                                    abilities={model.abilities}
                                    contextWindowTokens={model.contextWindowTokens}
                                  />
                                </Flex>
                              </Flex>
                            </Flex>
                            <Checkbox
                              aria-label={`选择 ${model.displayName}`}
                              checked={selected}
                              onChange={(checked) => setModelSelection([model], checked)}
                            />
                          </Flex>
                        )
                      })}
                    </Flex>
                  ) : null}
                </section>
              )
            })}
          </div>
        ) : null}

        <Text className='text-xs' type='secondary'>
          已选 {selectedCount} 个模型 · 当前显示 {filteredModels.length} 个
        </Text>
      </Flex>
    </Modal>
  )
}

const ModelCatalogTags = ({
  abilities,
  contextWindowTokens,
}: {
  abilities?: ModelAbilities
  contextWindowTokens?: number
}) => {
  const tags = CAPABILITY_ITEMS.filter((item) => abilities?.[item.key])
  if (tags.length === 0 && contextWindowTokens == null) return null

  return (
    <Flex className='shrink-0 items-center gap-[3px]'>
      {tags.map((item) => (
        <Tooltip key={item.key} title={item.label}>
          <Tag color={item.color} size='small'>
            <Icon icon={item.icon} size={12} />
          </Tag>
        </Tooltip>
      ))}
      {contextWindowTokens == null ? null : (
        <Tooltip title={`上下文窗口 ${formatTokenNumber(contextWindowTokens)} tokens`}>
          <Tag size='small'>{formatTokenNumber(contextWindowTokens)}</Tag>
        </Tooltip>
      )}
    </Flex>
  )
}

ModelCatalogModal.displayName = 'ModelCatalogModal'

export default ModelCatalogModal
