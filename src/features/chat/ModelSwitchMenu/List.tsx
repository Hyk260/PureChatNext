'use client'

import { ActionIcon, Icon, ProviderIcon, Text, Flex } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { LucideArrowRight, LucideBolt } from 'lucide-react'
import { memo } from 'react'
import { useNavigate } from 'react-router'

import { menuKey } from './types'
import type { ListItem } from './types'
import { ModelRow, MultiProviderModelRow } from './ModelRow'

const styles = createStaticStyles(({ css }) => ({
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
}))

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
                  className={[styles.menuItem, 'items-center gap-2']}
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
                  <Flex className='items-center gap-2 min-w-0'>
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
                  className={[styles.menuItem, 'items-center gap-2']}
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
