'use client'

import { getErrorMessage } from '@pure/utils/error'
import { toast } from '@lobehub/ui'
import { Block, Button, Flex, Text } from '@pure/ui'
import type { ServiceModelSettingsKey, ServiceModelSettingsPatch } from '@pure/types'

import { useServiceModelSettings } from './api'
import { ServiceModelPicker } from './ServiceModelPicker'

const SETTINGS = [
  {
    description: '新话题首次得到完整回复后自动生成标题。留空时跟随当前聊天模型。',
    key: 'topicNaming',
    title: '话题自动命名',
  },
  {
    description: '历史较长时用此模型生成对话摘要。留空时跟随当前聊天模型。',
    key: 'historyCompression',
    title: '会话历史压缩',
  },
] as const satisfies Array<{ description: string; key: ServiceModelSettingsKey; title: string }>

export default function ServiceModelSettingsPage() {
  const { data, error, isLoading, mutate, save, saving } = useServiceModelSettings()
  const saveModel = async (patch: ServiceModelSettingsPatch) => {
    try {
      await save(patch)
    } catch (error) {
      toast.error(getErrorMessage(error, '保存服务模型失败'))
    }
  }

  if (error) {
    return (
      <Flex className='flex-col gap-3 p-6'>
        <Text type='danger'>{error.message}</Text>
        <Button onClick={mutate}>重试</Button>
      </Flex>
    )
  }

  if (isLoading || !data) {
    return <Text className='p-6' role='status'>正在加载服务模型设置…</Text>
  }

  return (
    <Flex className='w-full flex-col gap-5 px-4 py-5 sm:px-8'>
      {SETTINGS.map(({ description, key, title }) => (
        <Block key={key} className='rounded-2xl p-5 sm:p-6' variant='outlined'>
          <Flex className='flex-col gap-4'>
            <Flex className='flex-col gap-1'>
              <Text className='text-base font-semibold'>{title}</Text>
              <Text className='text-[13px]' type='secondary'>
                {description}
              </Text>
            </Flex>
            <ServiceModelPicker
              resetLabel='恢复跟随'
              unselectedLabel='跟随当前聊天模型'
              selected={data[key]}
              onChange={(model) => saveModel({ [key]: model })}
              onReset={data[key] ? () => saveModel({ [key]: null }) : undefined}
            />
          </Flex>
        </Block>
      ))}
      {saving ? (
        <Text className='px-1' role='status' type='secondary'>
          正在保存…
        </Text>
      ) : null}
    </Flex>
  )
}
