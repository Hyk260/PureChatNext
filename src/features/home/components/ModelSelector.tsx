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
  Text,
} from '@lobehub/ui'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import { ChevronDownIcon } from 'lucide-react'
import { memo, useMemo } from 'react'

import { findHomeModel, groupHomeModelsByProvider, HOME_MODELS } from '@/const/home/models'
import { useHomeStore } from '@/features/home/store/useHomeStore'

const styles = createStaticStyles(({ css }) => ({
  chevron: css`
    color: ${cssVar.colorTextQuaternary};
  `,
  itemActive: css`
    background: ${cssVar.colorFillSecondary};
  `,
  name: css`
    overflow: hidden;
    max-width: 160px;
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  providerLabel: css`
    padding-inline: 8px;
    font-size: 11px;
    color: ${cssVar.colorTextQuaternary};
  `,
  trigger: css`
    cursor: pointer;
    border-radius: 6px;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
}))

const ModelSelector = memo(() => {
  const selectedModel = useHomeStore((s) => s.selectedModel)
  const selectedProvider = useHomeStore((s) => s.selectedProvider)
  const setSelectedModel = useHomeStore((s) => s.setSelectedModel)

  const current = useMemo(
    () => findHomeModel(selectedProvider, selectedModel),
    [selectedModel, selectedProvider],
  )

  const groups = useMemo(() => groupHomeModelsByProvider(), [])

  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger className={styles.trigger}>
        <Center horizontal height={28} paddingInline={6}>
          <Flexbox horizontal align='center' gap={4}>
            <ModelIcon model={current.model} size={16} type='mono' />
            <span className={styles.name}>{current.displayName}</span>
            <ChevronDownIcon className={styles.chevron} size={14} />
          </Flexbox>
        </Center>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPositioner placement='top'>
          <DropdownMenuPopup style={{ minWidth: 240, padding: 4 }}>
            {[...groups.entries()].map(([provider, models]) => (
              <Flexbox key={provider} gap={2}>
                <Text className={styles.providerLabel}>{provider}</Text>
                {models.map((item) => {
                  const active =
                    item.provider === selectedProvider && item.model === selectedModel

                  return (
                    <DropdownMenuItem
                      key={`${item.provider}:${item.model}`}
                      className={cx(active && styles.itemActive)}
                      onClick={() => setSelectedModel(item.provider, item.model)}
                    >
                      <Flexbox horizontal align='center' gap={8}>
                        <ModelIcon model={item.model} size={16} type='mono' />
                        <Text ellipsis fontSize={13}>
                          {item.displayName}
                        </Text>
                      </Flexbox>
                    </DropdownMenuItem>
                  )
                })}
              </Flexbox>
            ))}
          </DropdownMenuPopup>
        </DropdownMenuPositioner>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  )
})

ModelSelector.displayName = 'ModelSelector'

export default ModelSelector

export { HOME_MODELS }
