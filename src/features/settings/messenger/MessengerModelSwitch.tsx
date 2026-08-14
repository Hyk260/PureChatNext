'use client'

import { ModelIcon, Text, Flexbox } from '@pure/ui'
import { getAiModel } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'
import { createStaticStyles, cssVar } from 'antd-style'
import { ChevronDownIcon } from 'lucide-react'
import { memo } from 'react'

import ModelSwitchMenu from '@/features/chat/ModelSwitchMenu'

const styles = createStaticStyles(({ css }) => ({
  chevron: css`
    flex: none;
    color: ${cssVar.colorTextQuaternary};
  `,
  modelTrigger: css`
    cursor: pointer;
    max-width: 360px;
    padding-block: 4px;
    padding-inline: 6px;
    border-radius: 6px;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
}))

export interface MessengerModelSwitchProps {
  allowedProviders?: readonly string[]
  disabled?: boolean
  modelId: string
  onSelect: (provider: string, model: string) => void
  provider: string
}

/** 渠道设置页共用的模型切换入口（与 /chat 同一套 ModelSwitchMenu）。 */
export const MessengerModelSwitch = memo<MessengerModelSwitchProps>(
  ({ allowedProviders, disabled, modelId, onSelect, provider }) => {
    const currentDisplayName = getAiModel(provider as ModelProviderId, modelId)?.displayName ?? modelId

    return (
      <Flexbox gap={8}>
        <Text type='secondary' style={{ fontSize: 13 }}>
          模型
        </Text>
        <ModelSwitchMenu
          allowedProviders={allowedProviders}
          disabled={disabled}
          openOnHover={false}
          placement='bottomLeft'
          selectedModel={modelId}
          selectedProvider={provider}
          onSelect={onSelect}
        >
          <Flexbox
            horizontal
            align='center'
            className={styles.modelTrigger}
            gap={6}
            style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : undefined }}
          >
            <ModelIcon model={modelId} size={18} />
            <Text ellipsis style={{ fontSize: 13, minWidth: 0 }}>
              {currentDisplayName}
            </Text>
            <ChevronDownIcon className={styles.chevron} size={14} />
          </Flexbox>
        </ModelSwitchMenu>
      </Flexbox>
    )
  }
)

MessengerModelSwitch.displayName = 'MessengerModelSwitch'
