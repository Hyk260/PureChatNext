'use client'

import { Flexbox, Text } from '@lobehub/ui'
import { Slider, Switch } from 'antd'
import { memo } from 'react'

import { DEFAULT_CHAT_LLM_PARAMS } from '@/features/chat/types'
import type { ChatLlmParams } from '@/features/chat/types'

type ParamKey = keyof ChatLlmParams

const ROWS: { key: ParamKey; label: string; min: number; max: number; step: number }[] = [
  { key: 'temperature', label: '创造力', min: 0, max: 2, step: 0.1 },
  { key: 'top_p', label: '开放性', min: 0, max: 1, step: 0.1 },
  { key: 'presence_penalty', label: '词汇丰富度', min: -2, max: 2, step: 0.1 },
  { key: 'frequency_penalty', label: '话题发散', min: -2, max: 2, step: 0.1 },
]

type Props = {
  value: ChatLlmParams
  onChange: (patch: Partial<ChatLlmParams>) => void
}

const ParamsPanel = memo<Props>(({ value, onChange }) => (
  <Flexbox gap={16} padding={16} style={{ minWidth: 260 }}>
    <Text weight={500}>高级设置</Text>
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
))

ParamsPanel.displayName = 'ParamsPanel'

export default ParamsPanel
