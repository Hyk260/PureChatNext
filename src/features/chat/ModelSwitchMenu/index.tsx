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
  /** Limit listed providers (e.g. channel availability). Unset = all enabled settings providers. */
  allowedProviders?: readonly string[]
  children: ReactNode
  disabled?: boolean
  openOnHover?: boolean
  /** Controlled select. When set, does not write the home/chat model store. */
  onSelect?: (provider: string, model: string) => void
  placement?: 'topLeft' | 'bottomLeft' | 'topRight' | 'bottomRight'
  selectedModel?: string
  selectedProvider?: string
}

/**
 * Shared model dropdown shell with by-model / by-provider views and hover details.
 */
const ModelSwitchMenu = memo<ModelSwitchMenuProps>(
  ({
    allowedProviders,
    children,
    disabled,
    openOnHover = true,
    onSelect,
    placement = 'topLeft',
    selectedModel: selectedModelProp,
    selectedProvider: selectedProviderProp,
  }) => {
    const [open, setOpen] = useState(false)
    const [keyword, setKeyword] = useState('')
    const [groupMode, setGroupMode] = useState<GroupMode>('byProvider')
    const storeModel = useHomeStore((s) => s.selectedModel)
    const storeProvider = useHomeStore((s) => s.selectedProvider)
    const setStoreModel = useHomeStore((s) => s.setSelectedModel)
    const configs = useProviderConfigStore((s) => s.configs)
    const scrollListenersRef = useRef(new Set<() => void>())
    const isControlled = onSelect != null
    const selectedModel = selectedModelProp ?? storeModel
    const selectedProvider = selectedProviderProp ?? storeProvider

    const enabledProviders = useMemo<EnabledProviderGroup[]>(() => {
      const groups: EnabledProviderGroup[] = []

      for (const providerId of SETTINGS_PROVIDER_IDS) {
        if (allowedProviders && !allowedProviders.includes(providerId)) continue
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
        if (allowedProviders) return []
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
    }, [allowedProviders, configs])

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

    const handleSelect = useCallback(
      (provider: string, model: string) => {
        if (onSelect) onSelect(provider, model)
        else setStoreModel(provider, model)
      },
      [onSelect, setStoreModel]
    )

    useEffect(() => {
      if (isControlled) return
      const stillAvailable = availableModels.some(
        (item) => item.provider === selectedProvider && item.model === selectedModel
      )
      if (stillAvailable) return

      const fallback = availableModels[0] ?? DEFAULT_HOME_MODEL
      setStoreModel(fallback.provider, fallback.model)
    }, [availableModels, isControlled, selectedModel, selectedProvider, setStoreModel])

    return (
      <DropdownMenuRoot
        open={disabled ? false : open}
        onOpenChange={(next) => {
          if (disabled) return
          setOpen(next)
          if (!next) setKeyword('')
        }}
      >
        <DropdownMenuTrigger className={styles.trigger} openOnHover={disabled ? false : openOnHover}>
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
                onSelect={handleSelect}
              />
            </DropdownMenuPopup>
          </DropdownMenuPositioner>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    )
  }
)

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
        const catalog = getAiModel(selectedProvider, model.id)
        return {
          abilities: catalog?.abilities,
          displayName: model.displayName,
          model: model.id,
          provider: selectedProvider,
        } satisfies HomeModelItem
      }
    }

    const homeModel = findHomeModel(selectedProvider, selectedModel)
    return { ...homeModel, abilities: getAiModel(selectedProvider as ModelProviderId, selectedModel)?.abilities }
  }, [configs, selectedModel, selectedProvider])
}
