'use client'

import { getAiModel } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'
import {
  ActionIcon,
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
  Tag,
  Text,
  Flex,
} from '@pure/ui'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import { Check, LucideArrowRight, LucideBolt } from 'lucide-react'
import { memo, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import ModelFeatureTags from '@/features/community/components/ModelFeatureTags'

import ModelDetailPanel from './ModelDetailPanel'
import { menuKey } from './types'
import type { ListItem, ModelWithProviders } from './types'

const styles = createStaticStyles(({ css }) => ({
  detailPopup: css`
    user-select: none;
    overscroll-behavior: contain;
    width: 400px;
  `,
  empty: css`
    padding: 24px 12px;
    color: ${cssVar.colorTextQuaternary};
    font-size: 13px;
    text-align: center;
  `,
  groupHeader: css`
    width: 100%;
    color: ${cssVar.colorTextSecondary};
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

const isProModel = (displayName: string) => /pro/i.test(displayName)

interface ModelRowContentProps {
  abilities?: ModelWithProviders['abilities']
  contextWindowTokens?: number
  displayName: string
  model: string
  provider: string
}

const ModelRowContent = memo<ModelRowContentProps>(
  ({ abilities, contextWindowTokens, displayName, model, provider }) => {
    const card = getAiModel(provider as ModelProviderId, model)

    return (
      <Flex className='flex-row items-center gap-2 min-w-[0px] w-full'>
        <ModelIcon model={model} size={20} />
        <Text ellipsis style={{ fontSize: 13, flex: 1, minWidth: 0 }}>
          {displayName}
        </Text>
        <div style={{ flexShrink: 0, maxWidth: 120 }}>
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

interface ModelRowProps {
  active: boolean
  abilities?: ModelRowContentProps['abilities']
  contextWindowTokens?: number
  detailProvider: string
  displayName: string
  model: string
  onSelect: () => void
  subscribeScroll?: (cb: () => void) => () => void
}

const ModelRow = memo<ModelRowProps>(
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

interface MultiProviderModelRowProps {
  activeKey: string
  data: ModelWithProviders
  onClose: () => void
  onSelect: (provider: string, model: string) => void
  subscribeScroll?: (cb: () => void) => () => void
}

const MultiProviderModelRow = memo<MultiProviderModelRowProps>(
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
                          <Flex className='flex-row items-center gap-2'>
                            <ProviderIcon provider={provider.id} size={20} type='color' />
                            <Text ellipsis style={{ fontSize: 13 }}>
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

export interface ModelSwitchListProps {
  activeKey: string
  items: ListItem[]
  onClose: () => void
  onScroll?: () => void
  onSelect: (provider: string, model: string) => void
  subscribeScroll?: (cb: () => void) => () => void
}

const ModelSwitchList = memo<ModelSwitchListProps>(
  ({ activeKey, items, onClose, onScroll, onSelect, subscribeScroll }) => {
    const navigate = useNavigate()

    if (items.length === 0) {
      return <div className={styles.empty}>未找到匹配模型</div>
    }

    return (
      <div className={styles.list} onScroll={onScroll}>
        {items.map((item) => {
          switch (item.type) {
            case 'no-provider': {
              return (
                <Flex
                  key='no-provider'

                  className={[styles.menuItem, 'flex-row items-center gap-2']}

                  style={{ color: cssVar.colorTextTertiary, cursor: 'pointer' }}
                  onClick={() => {
                    onClose()
                    navigate('/settings/provider/all')
                  }}
                >
                  前往配置服务商
                  <Icon icon={LucideArrowRight} size={14} />
                </Flex>
              )
            }

            case 'group-header': {
              return (
                <Flex
                  key={`header-${item.provider.id}`}

                  className={[styles.groupHeader, 'flex-between py-[12px_4px] px-[12px_8px]']}
                >
                  <Flex className='flex-row items-center gap-2 min-w-[0px]'>
                    <ProviderIcon provider={item.provider.id} size={18} type='color' />
                    <Text ellipsis style={{ fontSize: 12 }}>
                      {item.provider.name}
                    </Text>
                  </Flex>
                  <ActionIcon
                    icon={LucideBolt}
                    size='small'
                    title='前往服务商设置'
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onClose()
                      navigate(`/settings/provider/${item.provider.id}`)
                    }}
                  />
                </Flex>
              )
            }

            case 'empty-model': {
              return (
                <Flex
                  key={`empty-${item.provider.id}`}

                  className={[styles.menuItem, 'flex-row items-center gap-2']}

                  style={{ color: cssVar.colorTextTertiary, cursor: 'pointer' }}
                  onClick={() => {
                    onClose()
                    navigate(`/settings/provider/${item.provider.id}`)
                  }}
                >
                  暂无启用模型
                  <Icon icon={LucideArrowRight} size={14} />
                </Flex>
              )
            }

            case 'provider-model-item': {
              const key = menuKey(item.provider.id, item.model.model)
              return (
                <ModelRow
                  key={key}
                  active={key === activeKey}
                  detailProvider={item.provider.id}
                  displayName={item.model.displayName}
                  model={item.model.model}
                  abilities={item.model.abilities}
                  contextWindowTokens={item.model.contextWindowTokens}
                  subscribeScroll={subscribeScroll}
                  onSelect={() => {
                    onClose()
                    onSelect(item.provider.id, item.model.model)
                  }}
                />
              )
            }

            case 'model-item-single': {
              const provider = item.data.providers[0]
              if (!provider) return null
              const key = menuKey(provider.id, item.data.model)
              return (
                <ModelRow
                  key={key}
                  active={key === activeKey}
                  detailProvider={provider.id}
                  displayName={item.data.displayName}
                  model={item.data.model}
                  subscribeScroll={subscribeScroll}
                  onSelect={() => {
                    onClose()
                    onSelect(provider.id, item.data.model)
                  }}
                />
              )
            }

            case 'model-item-multiple': {
              return (
                <MultiProviderModelRow
                  key={item.data.model}
                  activeKey={activeKey}
                  data={item.data}
                  subscribeScroll={subscribeScroll}
                  onClose={onClose}
                  onSelect={onSelect}
                />
              )
            }

            default:
              return null
          }
        })}
      </div>
    )
  }
)

ModelSwitchList.displayName = 'ModelSwitchList'

export default ModelSwitchList
