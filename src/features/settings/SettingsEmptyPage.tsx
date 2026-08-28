'use client'

import { Text, Flex } from '@pure/ui'

interface SettingsEmptyPageProps {
  description?: string
}

export function SettingsEmptyPage({ description = '该设置项暂未开放，敬请期待。' }: SettingsEmptyPageProps) {
  return (
    <Flex className='flex-col gap-6 py-[24px_64px] px-6 w-full'>
      <Text type='secondary'>{description}</Text>
    </Flex>
  )
}
