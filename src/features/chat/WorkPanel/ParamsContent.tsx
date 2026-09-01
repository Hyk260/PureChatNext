'use client'

import { Text, Flex } from '@pure/ui'
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
  onChange: (patch: Partial<ChatLlmParams>) => void
  value: ChatLlmParams
}

const ParamsContent = memo<Props>(({ value, onChange }) => (
  <Flex className='flex-col gap-4 p-4 min-h-0 overflow-auto'>
    {ROWS.map((row) => {
      const enabled = value[row.key] !== null
      const display = value[row.key] ?? DEFAULT_CHAT_LLM_PARAMS[row.key]!

      return (
        <Flex className='flex-col gap-2' key={row.key}>
          <Flex className='flex-between'>
            <Flex className='flex-row items-center gap-2'>
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
            </Flex>
            <Text type='secondary'>{enabled ? Number(display).toFixed(1) : '—'}</Text>
          </Flex>
          <Slider
            disabled={!enabled}
            max={row.max}
            min={row.min}
            step={row.step}
            value={Number(display)}
            onChange={(v) => onChange({ [row.key]: v })}
          />
        </Flex>
      )
    })}
  </Flex>
))

ParamsContent.displayName = 'ParamsContent'

export default ParamsContent
