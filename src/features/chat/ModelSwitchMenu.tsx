'use client'

import { ModelIcon } from '@lobehub/icons'
import {
  DropdownMenuItem,
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  Flexbox,
  SearchBar,
  stopPropagation,
  Tag,
  Text,
} from '@lobehub/ui'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import { memo, type ReactNode, useEffect, useMemo, useState } from 'react'

import {
  DEFAULT_HOME_MODEL,
  findHomeModel,
  type HomeModelItem,
} from '@/const/home/models'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import { isSettingsProviderId } from '@/features/settings/provider/const'
import { useProviderConfigStore } from '@/features/settings/provider/store/useProviderConfigStore'

const styles = createStaticStyles(({ css }) => ({
  container: css`
    pointer-events: auto;
    user-select: none;
    overflow: hidden;
    width: 300px;
    padding: 0 !important;
  `,
  empty: css`
    padding: 24px 12px;
    color: ${cssVar.colorTextQuaternary};
    font-size: 13px;
    text-align: center;
  `,
  itemActive: css`
    background: ${cssVar.colorFillTertiary};
  `,
  list: css`
    overflow: hidden auto;
    overscroll-behavior: contain;
    max-height: 320px;
    padding-block: 4px;
  `,
  menuItem: css`
    margin-block: 1px;
    margin-inline: 4px;
    padding-block: 8px;
    padding-inline: 8px;
    border-radius: ${cssVar.borderRadiusSM};
  `,
  toolbar: css`
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  /** Aligns with lobe `ModelSwitchPanel` DropdownMenuTrigger */
  trigger: css`
    display: inline-flex;
    outline: none;

    svg:focus {
      outline: none;
    }
  `,
}))

const isProModel = (item: HomeModelItem) => /pro/i.test(item.displayName)

export interface ModelSwitchMenuProps {
  children: ReactNode
  openOnHover?: boolean
  placement?: 'topLeft' | 'bottomLeft' | 'topRight' | 'bottomRight'
}

/**
 * Shared model dropdown shell — mirrors lobe `ModelSwitchPanel`.
 */
const ModelSwitchMenu = memo<ModelSwitchMenuProps>(
  ({ children, openOnHover = true, placement = 'topLeft' }) => {
    const [open, setOpen] = useState(false)
    const [keyword, setKeyword] = useState('')
    const selectedModel = useHomeStore((s) => s.selectedModel)
    const selectedProvider = useHomeStore((s) => s.selectedProvider)
    const setSelectedModel = useHomeStore((s) => s.setSelectedModel)
    const configs = useProviderConfigStore((s) => s.configs)

    // Fallback when no provider is enabled yet — still show builtin defaults so chat works.
    const availableModels = useMemo<HomeModelItem[]>(() => {
      const enabled: HomeModelItem[] = []

      for (const providerId of Object.keys(configs) as Array<keyof typeof configs>) {
        const config = configs[providerId]
        if (!config?.enabled) continue

        for (const model of config.models ?? []) {
          if (!model.enabled) continue
          enabled.push({
            displayName: model.displayName,
            model: model.id,
            provider: providerId,
          })
        }
      }

      if (enabled.length > 0) return enabled
      return [DEFAULT_HOME_MODEL]
    }, [configs])

    const filteredModels = useMemo(() => {
      const query = keyword.trim().toLowerCase()
      if (!query) return availableModels

      return availableModels.filter(
        (item) =>
          item.displayName.toLowerCase().includes(query) ||
          item.model.toLowerCase().includes(query) ||
          item.provider.toLowerCase().includes(query),
      )
    }, [availableModels, keyword])

    // If current selection is no longer available, fall back.
    useEffect(() => {
      const stillAvailable = availableModels.some(
        (item) => item.provider === selectedProvider && item.model === selectedModel,
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
              <Flexbox
                horizontal
                align='center'
                className={styles.toolbar}
                gap={4}
                paddingBlock={8}
                paddingInline={8}
              >
                <SearchBar
                  allowClear
                  placeholder='搜索模型...'
                  size='small'
                  style={{ flex: 1 }}
                  value={keyword}
                  variant='borderless'
                  onChange={(event) => setKeyword(event.target.value)}
                  onKeyDown={stopPropagation}
                />
              </Flexbox>

              <div className={styles.list}>
                {filteredModels.length === 0 ? (
                  <div className={styles.empty}>未找到匹配模型</div>
                ) : (
                  filteredModels.map((item) => {
                    const active =
                      item.provider === selectedProvider && item.model === selectedModel

                    return (
                      <DropdownMenuItem
                        key={`${item.provider}:${item.model}`}
                        className={cx(styles.menuItem, active && styles.itemActive)}
                        onClick={() => setSelectedModel(item.provider, item.model)}
                      >
                        <Flexbox horizontal align='center' gap={8} style={{ minWidth: 0 }}>
                          <ModelIcon model={item.model} size={20} />
                          <Text ellipsis fontSize={13} style={{ flex: 1, minWidth: 0 }}>
                            {item.displayName}
                          </Text>
                          {isProModel(item) ? (
                            <Tag color='gold' size='small'>
                              Pro
                            </Tag>
                          ) : null}
                        </Flexbox>
                      </DropdownMenuItem>
                    )
                  })
                )}
              </div>
            </DropdownMenuPopup>
          </DropdownMenuPositioner>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    )
  },
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
