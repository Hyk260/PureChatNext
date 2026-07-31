'use client'

import {
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  stopPropagation,
} from '@pure/ui'
import { getAiModel } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'
import { createStaticStyles } from 'antd-style'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { DEFAULT_HOME_MODEL, findHomeModel } from '@/const/home/models'
import type { HomeModelItem } from '@/const/home/models'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import {
  getSettingsProviderMeta,
  isSettingsProviderId,
  SETTINGS_PROVIDER_IDS,
} from '@/features/settings/provider/const'
import { useProviderConfigStore } from '@/features/settings/provider/store/useProviderConfigStore'

import ModelSwitchList from './List'
import Toolbar from './Toolbar'
import { menuKey } from './types'
import type { EnabledProviderGroup, GroupMode } from './types'
import { useBuildListItems } from './useBuildListItems'

/** model-bank `enabled: false` 的模型不进入切换列表（即使本地 store 曾被打开）。 */
const isCatalogEnabled = (providerId: ModelProviderId, modelId: string) =>
  getAiModel(providerId, modelId)?.enabled !== false

const styles = createStaticStyles(({ css }) => ({
  container: css`
    pointer-events: auto;
    user-select: none;
    overflow: hidden;
    width: 300px;
    padding: 0 !important;
  `,
  trigger: css`
    display: inline-flex;
    outline: none;

    svg:focus {
      outline: none;
    }
  `,
}))

export interface ModelSwitchMenuProps {
  children: ReactNode
  openOnHover?: boolean
  placement?: 'topLeft' | 'bottomLeft' | 'topRight' | 'bottomRight'
}

/**
 * Shared model dropdown shell with by-model / by-provider views and hover details.
 */
const ModelSwitchMenu = memo<ModelSwitchMenuProps>(({ children, openOnHover = true, placement = 'topLeft' }) => {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [groupMode, setGroupMode] = useState<GroupMode>('byProvider')
  const selectedModel = useHomeStore((s) => s.selectedModel)
  const selectedProvider = useHomeStore((s) => s.selectedProvider)
  const setSelectedModel = useHomeStore((s) => s.setSelectedModel)
  const configs = useProviderConfigStore((s) => s.configs)
  const scrollListenersRef = useRef(new Set<() => void>())

  const enabledProviders = useMemo<EnabledProviderGroup[]>(() => {
    const groups: EnabledProviderGroup[] = []

    for (const providerId of SETTINGS_PROVIDER_IDS) {
      const config = configs[providerId]
      if (!config?.enabled) continue

      const models: HomeModelItem[] = []
      for (const model of config.models ?? []) {
        if (!model.enabled) continue
        if (!isCatalogEnabled(providerId, model.id)) continue
        models.push({
          displayName: model.displayName,
          model: model.id,
          provider: providerId,
        })
      }

      groups.push({
        id: providerId,
        models,
        name: getSettingsProviderMeta(providerId).name,
      })
    }

    if (groups.length === 0) {
      return [
        {
          id: DEFAULT_HOME_MODEL.provider,
          models: [DEFAULT_HOME_MODEL],
          name: isSettingsProviderId(DEFAULT_HOME_MODEL.provider)
            ? getSettingsProviderMeta(DEFAULT_HOME_MODEL.provider).name
            : DEFAULT_HOME_MODEL.provider,
        },
      ]
    }

    return groups
  }, [configs])

  const availableModels = useMemo(() => enabledProviders.flatMap((group) => group.models), [enabledProviders])

  const listItems = useBuildListItems(enabledProviders, groupMode, keyword)
  const activeKey = menuKey(selectedProvider, selectedModel)

  const subscribeScroll = useCallback((cb: () => void) => {
    scrollListenersRef.current.add(cb)
    return () => {
      scrollListenersRef.current.delete(cb)
    }
  }, [])

  const handleListScroll = useCallback(() => {
    for (const listener of scrollListenersRef.current) listener()
  }, [])

  useEffect(() => {
    const stillAvailable = availableModels.some(
      (item) => item.provider === selectedProvider && item.model === selectedModel
    )
    if (stillAvailable) return

    const fallback = availableModels[0] ?? DEFAULT_HOME_MODEL
    setSelectedModel(fallback.provider, fallback.model)
  }, [availableModels, selectedModel, selectedProvider, setSelectedModel])

  return (
    <DropdownMenuRoot
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setKeyword('')
      }}
    >
      <DropdownMenuTrigger className={styles.trigger} openOnHover={openOnHover}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPositioner hoverTrigger={openOnHover} placement={placement}>
          <DropdownMenuPopup className={styles.container} onKeyDown={stopPropagation}>
            <Toolbar
              groupMode={groupMode}
              keyword={keyword}
              onGroupModeChange={setGroupMode}
              onKeywordChange={setKeyword}
            />
            <ModelSwitchList
              activeKey={activeKey}
              items={listItems}
              subscribeScroll={subscribeScroll}
              onClose={() => setOpen(false)}
              onScroll={handleListScroll}
              onSelect={(provider, model) => setSelectedModel(provider, model)}
            />
          </DropdownMenuPopup>
        </DropdownMenuPositioner>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  )
})

ModelSwitchMenu.displayName = 'ModelSwitchMenu'

export default ModelSwitchMenu

export const useCurrentHomeModel = () => {
  const selectedModel = useHomeStore((s) => s.selectedModel)
  const selectedProvider = useHomeStore((s) => s.selectedProvider)
  const configs = useProviderConfigStore((s) => s.configs)

  return useMemo(() => {
    if (isSettingsProviderId(selectedProvider)) {
      const model = configs[selectedProvider]?.models.find((item) => item.id === selectedModel)
      if (model) {
        return {
          displayName: model.displayName,
          model: model.id,
          provider: selectedProvider,
        } satisfies HomeModelItem
      }
    }

    return findHomeModel(selectedProvider, selectedModel)
  }, [configs, selectedModel, selectedProvider])
}
