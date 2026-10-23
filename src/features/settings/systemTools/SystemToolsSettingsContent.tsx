'use client'


import { toast, Divider } from '@lobehub/ui'
import { ActionIcon, Block, Button, Flex, Skeleton, Tag, Text } from '@pure/ui'
import { copyToClipboard } from '@pure/utils/client'
import { Check, CircleX, Copy, RefreshCw } from 'lucide-react'
import { Fragment } from 'react'
import useSWR from 'swr'

import type { DesktopBuiltinTool, DesktopRuntimeTool, DesktopSystemTools } from '@/types/desktop'
import { getDesktopApi } from '@/types/desktop'

function truncatePath(value: string, max = 36): string {
  if (value.length <= max) return value
  return `…${value.slice(-(max - 1))}`
}

function SectionTitle({ title }: { title: string }) {
  return <Text className='px-4 pt-4 pb-0 text-base font-semibold'>{title}</Text>
}

function RuntimeToolRow({ onCopyPath, tool }: { onCopyPath: (path: string) => void; tool: DesktopRuntimeTool }) {
  const statusLabel = tool.available ? '可用' : '不可用'
  const StatusIcon = tool.available ? Check : CircleX
  const statusClassName = tool.available ? 'text-[var(--lobe-color-success)]' : 'text-[var(--lobe-color-text-tertiary)]'

  return (
    <Flex className='items-center gap-3 min-h-[64px] py-3 w-full min-w-0'>
      <Flex className='flex-col gap-1 flex-1 min-w-0'>
        <Flex className='items-center gap-2 min-w-0'>
          <Text strong>{tool.name}</Text>
          {tool.version ? (
            <Tag color='blue' size='small'>
              {tool.version}
            </Tag>
          ) : null}
        </Flex>
        <Text className='text-[13px]' type='secondary'>
          {tool.description}
        </Text>
      </Flex>
      {tool.path ? (
        <Flex className='items-center gap-1 shrink-0 max-w-[240px] min-w-0'>
          <Text className='truncate text-[12px]' title={tool.path} type='secondary'>
            {truncatePath(tool.path)}
          </Text>
          <ActionIcon icon={Copy} size='small' title='复制路径' onClick={() => onCopyPath(tool.path!)} />
        </Flex>
      ) : null}
      <Flex className={['items-center gap-1 shrink-0', statusClassName]}>
        <StatusIcon size={14} />
        <Text
          className='text-[13px]'
          color={tool.available ? 'var(--lobe-color-success)' : 'var(--lobe-color-text-tertiary)'}
        >
          {statusLabel}
        </Text>
      </Flex>
    </Flex>
  )
}

function BuiltinToolRow({ tool }: { tool: DesktopBuiltinTool }) {
  return (
    <Flex className='flex-col gap-1 min-h-[64px] justify-center py-3 w-full min-w-0'>
      <Flex className='items-center gap-2 min-w-0'>
        <Text strong>{tool.name}</Text>
        <Tag color='blue' size='small'>
          {tool.version}
        </Tag>
      </Flex>
      <Text className='text-[13px]' type='secondary'>
        {tool.description}
      </Text>
    </Flex>
  )
}

export function SystemToolsSettingsContent() {
  const hasDesktopApi = Boolean(getDesktopApi()?.getSystemTools)
  const { data, error, isLoading, mutate } = useSWR<DesktopSystemTools>(
    hasDesktopApi ? 'desktop-system-tools' : null,
    async () => {
      const api = getDesktopApi()
      if (!api?.getSystemTools) throw new Error('系统工具仅在桌面端可用。')
      return api.getSystemTools()
    },
    { revalidateOnFocus: false }
  )

  const handleCopyPath = async (path: string) => {
    await copyToClipboard(path)
    toast.success('已复制路径')
  }
  const handleRetry = () => mutate()

  if (!hasDesktopApi) {
    return (
      <Flex className='flex-col gap-6 py-6 pb-16 px-6 w-full'>
        <Block padding={16} variant='filled'>
          <Text type='secondary'>系统工具仅在桌面端可用。</Text>
        </Block>
      </Flex>
    )
  }

  return (
    <Flex className='flex-col gap-6 py-6 pb-16 px-6 w-full'>
      {isLoading && !data ? (
        <Block variant='outlined' className='rounded-2xl p-5 sm:p-6'>
          <Skeleton.Text rows={6} />
        </Block>
      ) : null}

      {error ? (
        <Block padding={16} variant='filled'>
          <Flex className='flex-between gap-3'>
            <Text type='secondary'>无法加载系统工具信息</Text>
            <Button icon={<RefreshCw size={14} />} onClick={handleRetry}>
              重试
            </Button>
          </Flex>
        </Block>
      ) : null}

      {data ? (
        <>
          <Block variant='outlined'>
            <SectionTitle title='运行环境' />
            <Flex className='flex-col px-4'>
              {data.runtime.map((tool, index) => (
                <Fragment key={tool.id}>
                  {index > 0 ? <Divider /> : null}
                  <RuntimeToolRow tool={tool} onCopyPath={handleCopyPath} />
                </Fragment>
              ))}
            </Flex>
          </Block>

          <Block variant='outlined'>
            <SectionTitle title='内建应用工具' />
            <Flex className='flex-col px-4'>
              {data.builtin.map((tool, index) => (
                <Fragment key={tool.id}>
                  {index > 0 ? <Divider /> : null}
                  <BuiltinToolRow tool={tool} />
                </Fragment>
              ))}
            </Flex>
          </Block>
        </>
      ) : null}
    </Flex>
  )
}
