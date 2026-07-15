'use client'

import { ActionIcon, Flexbox, Text } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { Slider, Switch } from 'antd'
import { PanelRightClose } from 'lucide-react'
import { memo } from 'react'

import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import { DEFAULT_CHAT_LLM_PARAMS } from '@/features/chat/types'
import type { ChatLlmParams } from '@/features/chat/types'

type ParamKey = keyof ChatLlmParams

const ROWS: { key: ParamKey; label: string; min: number; max: number; step: number }[] = [
  { key: 'temperature', label: '创造力', min: 0, max: 2, step: 0.1 },
  { key: 'top_p', label: '开放性', min: 0, max: 1, step: 0.1 },
  { key: 'presence_penalty', label: '词汇丰富度', min: -2, max: 2, step: 0.1 },
  { key: 'frequency_penalty', label: '话题发散', min: -2, max: 2, step: 0.1 },
]

const styles = createStaticStyles(({ css }) => ({
  header: css`
    flex: none;
    height: 44px;
    padding-inline: 8px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
}))

type Props = {
  value: ChatLlmParams
  onChange: (patch: Partial<ChatLlmParams>) => void
}

const ParamsPanel = memo<Props>(({ value, onChange }) => {
  const toggleRightCollapsed = useChatUiStore((s) => s.toggleRightCollapsed)

  return (
    <Flexbox height='100%' style={{ minWidth: 260 }}>
      <Flexbox horizontal align='center' className={styles.header} justify='space-between'>
        <Text style={{ marginInlineStart: 8 }} weight={500}>
          高级设置
        </Text>
        <ActionIcon
          icon={PanelRightClose}
          size='small'
          title='折叠参数栏'
          onClick={toggleRightCollapsed}
        />
      </Flexbox>
      <Flexbox gap={16} padding={16} style={{ minHeight: 0, overflow: 'auto' }}>
        {ROWS.map((row) => {
          const enabled = value[row.key] !== null
          const display = value[row.key] ?? DEFAULT_CHAT_LLM_PARAMS[row.key]!

          return (
            <Flexbox key={row.key} gap={8}>
              <Flexbox horizontal align='center' justify='space-between'>
                <Flexbox horizontal align='center' gap={8}>
                  <Text>{row.label}</Text>
                  <Switch
                    checked={enabled}
                    size='small'
                    onChange={(checked) =>
                      onChange({
                        [row.key]: checked ? DEFAULT_CHAT_LLM_PARAMS[row.key] : null,
                      })
                    }
                  />
                </Flexbox>
                <Text type='secondary'>{enabled ? Number(display).toFixed(1) : '—'}</Text>
              </Flexbox>
              <Slider
                disabled={!enabled}
                max={row.max}
                min={row.min}
                step={row.step}
                value={Number(display)}
                onChange={(v) => onChange({ [row.key]: v })}
              />
            </Flexbox>
          )
        })}
      </Flexbox>
    </Flexbox>
  )
})

ParamsPanel.displayName = 'ParamsPanel'

export default ParamsPanel
