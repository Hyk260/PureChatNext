'use client'

import {
  ActionIcon,
  Block,
  Button,
  copyToClipboard,
  Flex,
  Skeleton,
  Tag,
  Text,
} from '@pure/ui'
import { Divider } from 'antd'
import { Check, CircleX, Copy, RefreshCw } from 'lucide-react'
import { Fragment, useCallback, useEffect, useState } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
import type { DesktopBuiltinTool, DesktopRuntimeTool, DesktopSystemTools } from '@/types/desktop'
import { getDesktopApi } from '@/types/desktop'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

function truncatePath(value: string, max = 36): string {
  if (value.length <= max) return value
  return `…${value.slice(-(max - 1))}`
}

function SectionTitle({ title }: { title: string }) {
  return <Text className='px-4 pt-4 pb-0 text-base font-semibold'>{title}</Text>
}

function RuntimeToolRow({
  onCopyPath,
  tool,
}: {
  onCopyPath: (path: string) => void
  tool: DesktopRuntimeTool
}) {
  const statusLabel = tool.available ? '可用' : '不可用'
  const StatusIcon = tool.available ? Check : CircleX
  const statusClassName = tool.available
    ? 'text-[var(--ant-color-success)]'
    : 'text-[var(--ant-color-text-tertiary)]'

  return (
    <Flex className='flex-row items-center gap-3 min-h-[64px] py-3 w-full min-w-0'>
      <Flex className='flex-col gap-1 flex-1 min-w-0'>
        <Flex className='flex-row items-center gap-2 min-w-0'>
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
        <Flex className='flex-row items-center gap-1 shrink-0 max-w-[240px] min-w-0'>
          <Text className='truncate text-[12px]' title={tool.path} type='secondary'>
            {truncatePath(tool.path)}
          </Text>
          <ActionIcon icon={Copy} size='small' title='复制路径' onClick={() => onCopyPath(tool.path!)} />
        </Flex>
      ) : null}
      <Flex className={['flex-row items-center gap-1 shrink-0', statusClassName]}>
        <StatusIcon size={14} />
        <Text className={statusClassName} style={{ fontSize: 13 }}>
          {statusLabel}
        </Text>
      </Flex>
    </Flex>
  )
}

function BuiltinToolRow({ tool }: { tool: DesktopBuiltinTool }) {
  return (
    <Flex className='flex-col gap-1 min-h-[64px] justify-center py-3 w-full min-w-0'>
      <Flex className='flex-row items-center gap-2 min-w-0'>
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
  const { message } = useApp()
  const hasDesktopApi = Boolean(getDesktopApi()?.getSystemTools)
  const [state, setState] = useState<LoadState>(hasDesktopApi ? 'loading' : 'idle')
  const [data, setData] = useState<DesktopSystemTools | null>(null)

  const load = useCallback(async () => {
    const api = getDesktopApi()
    if (!api?.getSystemTools) {
      setState('idle')
      setData(null)
      return
    }
    setState('loading')
    try {
      const result = await api.getSystemTools()
      setData(result)
      setState('ready')
    } catch {
      setData(null)
      setState('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleCopyPath = async (path: string) => {
    await copyToClipboard(path)
    message.success('已复制路径')
  }

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
      {state === 'loading' ? (
        <Flex className='flex-col gap-6'>
          <Block padding={16} variant='filled'>
            <Skeleton active paragraph={{ rows: 6 }} title={{ width: 120 }} />
          </Block>
          <Block padding={16} variant='filled'>
            <Skeleton active paragraph={{ rows: 3 }} title={{ width: 140 }} />
          </Block>
        </Flex>
      ) : null}

      {state === 'error' ? (
        <Block padding={16} variant='filled'>
          <Flex className='flex-row items-center justify-between gap-3'>
            <Text type='secondary'>无法加载系统工具信息</Text>
            <Button icon={<RefreshCw size={14} />} onClick={() => void load()}>
              重试
            </Button>
          </Flex>
        </Block>
      ) : null}

      {state === 'ready' && data ? (
        <>
          <Block variant='filled'>
            <SectionTitle title='运行环境' />
            <Flex className='flex-col px-4'>
              {data.runtime.map((tool, index) => (
                <Fragment key={tool.id}>
                  {index > 0 ? <Divider style={{ margin: 0 }} /> : null}
                  <RuntimeToolRow tool={tool} onCopyPath={(path) => void handleCopyPath(path)} />
                </Fragment>
              ))}
            </Flex>
          </Block>

          <Block variant='filled'>
            <SectionTitle title='内建应用工具' />
            <Flex className='flex-col px-4'>
              {data.builtin.map((tool, index) => (
                <Fragment key={tool.id}>
                  {index > 0 ? <Divider style={{ margin: 0 }} /> : null}
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
