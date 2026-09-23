'use client'

import { getAiModel } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'
import {
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuItemIcon,
  DropdownMenuItemLabel,
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuSubmenuRoot,
  DropdownMenuSubmenuTrigger,
  Icon,
  ModelIcon,
  ProviderIcon,
  Text,
  Flex,
} from '@pure/ui'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import { Check } from 'lucide-react'
import { memo, useEffect, useState } from 'react'

import ModelFeatureTags from '@/features/community/components/ModelFeatureTags'

import ModelDetailPanel from './ModelDetailPanel'
import { menuKey } from './types'
import type { ModelWithProviders } from './types'

const styles = createStaticStyles(({ css }) => ({
  detailPopup: css`
    user-select: none;
    overscroll-behavior: contain;
    width: 400px;
  `,
  itemActive: css`
    background: ${cssVar.colorFillTertiary};
  `,
  rowWrap: css`
    margin-block: 1px;
    margin-inline: 4px;
  `,
  rowTrigger: css`
    width: 100%;
    padding-block: 8px;
    padding-inline: 8px;
    border-radius: ${cssVar.borderRadiusSM};
  `,
}))

export interface ModelRowContentProps {
  abilities?: ModelWithProviders['abilities']
  contextWindowTokens?: number
  displayName: string
  model: string
  provider: string
}

export const ModelRowContent = memo<ModelRowContentProps>(
  ({ abilities, contextWindowTokens, displayName, model, provider }) => {
    const card = getAiModel(provider as ModelProviderId, model)

    return (
      <Flex className='items-center gap-2 min-w-0 w-full'>
        <ModelIcon model={model} size={20} />
        <Text className='min-w-0 flex-1 text-[13px]' ellipsis>
          {displayName}
        </Text>
        <div className='max-w-[120px] shrink-0'>
          <ModelFeatureTags
            abilities={abilities ?? card?.abilities}
            contextWindowTokens={contextWindowTokens ?? card?.contextWindowTokens}
          />
        </div>
      </Flex>
    )
  }
)

ModelRowContent.displayName = 'ModelRowContent'

export interface ModelRowProps {
  active: boolean
  abilities?: ModelRowContentProps['abilities']
  contextWindowTokens?: number
  detailProvider: string
  displayName: string
  model: string
  onSelect: () => void
  subscribeScroll?: (cb: () => void) => () => void
}

export const ModelRow = memo<ModelRowProps>(
  ({ abilities, active, contextWindowTokens, detailProvider, displayName, model, onSelect, subscribeScroll }) => {
    const [detailOpen, setDetailOpen] = useState(false)

    useEffect(() => subscribeScroll?.(() => setDetailOpen(false)), [subscribeScroll])

    return (
      <div className={styles.rowWrap}>
        <DropdownMenuSubmenuRoot open={detailOpen} onOpenChange={setDetailOpen}>
          <DropdownMenuSubmenuTrigger
            className={cx(styles.rowTrigger, active && styles.itemActive)}
            onClick={(event) => {
              event.preventDefault()
              setDetailOpen(false)
              onSelect()
            }}
          >
            <ModelRowContent
              abilities={abilities}
              contextWindowTokens={contextWindowTokens}
              displayName={displayName}
              model={model}
              provider={detailProvider}
            />
          </DropdownMenuSubmenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuPositioner anchor={null} placement='right' sideOffset={12}>
              <DropdownMenuPopup className={styles.detailPopup}>
                <ModelDetailPanel model={model} provider={detailProvider} />
              </DropdownMenuPopup>
            </DropdownMenuPositioner>
          </DropdownMenuPortal>
        </DropdownMenuSubmenuRoot>
      </div>
    )
  }
)

ModelRow.displayName = 'ModelRow'

export interface MultiProviderModelRowProps {
  activeKey: string
  data: ModelWithProviders
  onClose: () => void
  onSelect: (provider: string, model: string) => void
  subscribeScroll?: (cb: () => void) => () => void
}

export const MultiProviderModelRow = memo<MultiProviderModelRowProps>(
  ({ activeKey, data, onClose, onSelect, subscribeScroll }) => {
    const [detailOpen, setDetailOpen] = useState(false)
    const defaultProvider = data.providers[0]
    const activeProvider = data.providers.find((p) => menuKey(p.id, data.model) === activeKey)
    const isActive = Boolean(activeProvider)
    const detailProvider = (activeProvider ?? defaultProvider)?.id ?? ''

    useEffect(() => subscribeScroll?.(() => setDetailOpen(false)), [subscribeScroll])

    if (!defaultProvider) return null

    return (
      <div className={styles.rowWrap}>
        <DropdownMenuSubmenuRoot open={detailOpen} onOpenChange={setDetailOpen}>
          <DropdownMenuSubmenuTrigger
            className={cx(styles.rowTrigger, isActive && styles.itemActive)}
            onClick={(event) => {
              event.preventDefault()
              setDetailOpen(false)
              onClose()
              onSelect(defaultProvider.id, data.model)
            }}
          >
            <ModelRowContent
              abilities={data.abilities}
              contextWindowTokens={data.contextWindowTokens}
              displayName={data.displayName}
              model={data.model}
              provider={detailProvider}
            />
          </DropdownMenuSubmenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuPositioner anchor={null} placement='right' sideOffset={12}>
              <DropdownMenuPopup className={styles.detailPopup}>
                <ModelDetailPanel model={data.model} provider={detailProvider} />
                <DropdownMenuGroup>
                  <DropdownMenuGroupLabel>使用此模型来自</DropdownMenuGroupLabel>
                  {data.providers.map((provider) => {
                    const key = menuKey(provider.id, data.model)
                    const isProviderActive = isActive ? activeKey === key : provider.id === defaultProvider.id

                    return (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => {
                          setDetailOpen(false)
                          onClose()
                          onSelect(provider.id, data.model)
                        }}
                      >
                        <DropdownMenuItemIcon>{isProviderActive ? <Check size={16} /> : null}</DropdownMenuItemIcon>
                        <DropdownMenuItemLabel>
                          <Flex className='items-center gap-2'>
                            <ProviderIcon provider={provider.id} size={20} type='color' />
                            <Text className='text-[13px]' ellipsis>
                              {provider.name}
                            </Text>
                          </Flex>
                        </DropdownMenuItemLabel>
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuGroup>
              </DropdownMenuPopup>
            </DropdownMenuPositioner>
          </DropdownMenuPortal>
        </DropdownMenuSubmenuRoot>
      </div>
    )
  }
)

MultiProviderModelRow.displayName = 'MultiProviderModelRow'
