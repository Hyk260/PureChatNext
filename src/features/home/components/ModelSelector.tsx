'use client'

import { ModelIcon } from '@lobehub/icons'
import {
  Center,
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
import { memo, useMemo, useState } from 'react'

import { findHomeModel, HOME_MODELS, type HomeModelItem } from '@/const/home/models'
import { useHomeStore } from '@/features/home/store/useHomeStore'

const styles = createStaticStyles(({ css }) => ({
  container: css`
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
  trigger: css`
    cursor: pointer;
    display: inline-flex;
    outline: none;
    border-radius: 24px;

    &:hover {
      background: ${cssVar.colorFillSecondary};
    }

    &:active .model-selector-icon {
      scale: 0.8;
    }

    svg:focus {
      outline: none;
    }
  `,
  triggerIcon: css`
    transition: scale 400ms cubic-bezier(0.215, 0.61, 0.355, 1);
  `,
}))

const isProModel = (item: HomeModelItem) => /pro/i.test(item.displayName)

const ModelSelector = memo(() => {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const selectedModel = useHomeStore((s) => s.selectedModel)
  const selectedProvider = useHomeStore((s) => s.selectedProvider)
  const setSelectedModel = useHomeStore((s) => s.setSelectedModel)

  const current = useMemo(
    () => findHomeModel(selectedProvider, selectedModel),
    [selectedModel, selectedProvider],
  )

  const filteredModels = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    if (!query) return HOME_MODELS

    return HOME_MODELS.filter(
      (item) =>
        item.displayName.toLowerCase().includes(query) ||
        item.model.toLowerCase().includes(query) ||
        item.provider.toLowerCase().includes(query),
    )
  }, [keyword])

  return (
    <DropdownMenuRoot
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setKeyword('')
      }}
    >
      <DropdownMenuTrigger className={styles.trigger}>
        <Center height={32} width={32}>
          <div className={cx(styles.triggerIcon, 'model-selector-icon')}>
            <ModelIcon model={current.model} size={20} />
          </div>
        </Center>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPositioner placement='topLeft'>
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
})

ModelSelector.displayName = 'ModelSelector'

export default ModelSelector

export { HOME_MODELS }
