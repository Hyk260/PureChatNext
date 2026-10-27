import { getErrorMessage } from '@pure/utils/error'
import { ActionIcon, Button, Select, Text, toast } from '@lobehub/ui'
import { Flex } from '@pure/ui'
import { SquareTerminal, Square, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { getDesktopApi } from '@/types/desktop'
import type { DesktopProject } from '@/types/desktop'

import type { TerminalPanelProps } from './index'
import { terminalManager, terminalProjectKey, useTerminalSessions } from './manager'
import { useTerminalPanelStore } from './store'
import TerminalView from './TerminalView'

const DESKTOP_VALUE = '__desktop__'

export default function Content({ projectName, onProjectChange }: TerminalPanelProps) {
  const [projects, setProjects] = useState<DesktopProject[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const hide = useTerminalPanelStore((s) => s.hide)

  const refresh = useCallback(() => {
    const api = getDesktopApi()
    if (!api) return Promise.resolve()
    return api
      .listProjects()
      .then((items) => {
        setProjects(items)
        setLoadError('')
        setLoaded(true)
      })
      .catch((error: unknown) => {
        setLoadError(getErrorMessage(error, '加载本机项目失败'))
      })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh, projectName])

  const project = projects.find((item) => item.name === projectName)
  const projectId = projectName === null ? null : project?.id
  const key = terminalProjectKey(projectId ?? null)
  const view = useTerminalSessions((s) => (projectId === undefined ? undefined : s.sessions[key]))
  const entry = view?.entry
  const missing = loaded && projectName !== null && !project
  const error = loadError || (missing ? '当前聊天未关联可用的本机项目，请选择桌面或其他项目' : view?.error)

  useEffect(() => {
    if (loaded && projectId !== undefined) terminalManager.ensure(projectId)
  }, [loaded, projectId])

  const handleSelect = async (value: string | string[] | null | undefined) => {
    if (typeof value !== 'string') return
    const next = value === DESKTOP_VALUE ? null : projects.find((item) => item.id === value)
    if (next === undefined) return
    setSaving(true)
    try {
      await onProjectChange(next)
    } catch (error) {
      toast.error(getErrorMessage(error, '切换项目失败'))
    } finally {
      setSaving(false)
    }
  }

  const stop = async () => {
    if (!entry) return
    try {
      await terminalManager.kill(entry)
    } catch (error) {
      toast.error(getErrorMessage(error, '结束终端失败'))
    }
  }

  const retry = async () => {
    if (loadError) return refresh()
    if (projectId === undefined) return
    try {
      await terminalManager.restart(projectId)
    } catch (error) {
      toast.error(getErrorMessage(error, '重新打开终端失败'))
    }
  }

  const options = [
    { value: DESKTOP_VALUE, label: '桌面' },
    ...projects.map((item) => ({ value: item.id, label: item.name, title: item.rootPath })),
  ]

  return (
    <Flex className='h-full min-h-0 flex-col overflow-hidden bg-app-surface'>
      <Flex
        role='toolbar'
        aria-label='终端工具栏'
        className='flex-between shrink-0 gap-2 border-b border-app-border-secondary px-2 py-1'
      >
        <Flex className='min-w-0 items-center gap-1.5'>
          <SquareTerminal size={13} />
          <Text ellipsis fontSize={12} title={entry?.info.cwd}>
            本机终端{project ? ` · ${project.name}` : ''}
          </Text>
        </Flex>
        <Flex className='items-center gap-1'>
          <label className='sr-only' htmlFor='terminal-project'>
            终端项目
          </label>
          {/* <Select
            id='terminal-project'
            className='min-w-24 max-w-48'
            disabled={saving}
            loading={saving}
            options={options}
            size='small'
            value={project?.id ?? (projectName === null ? DESKTOP_VALUE : null)}
            placeholder='选择本机项目'
            onChange={handleSelect}
            onOpenChange={(open) => {
              if (open) refresh()
            }}
          /> */}
          <ActionIcon
            aria-label='结束当前终端'
            disabled={!entry || view?.exited}
            icon={Square}
            size='small'
            title='结束当前终端'
            onClick={stop}
          />
          <ActionIcon aria-label='收起终端' icon={X} size='small' title='收起终端' onClick={hide} />
        </Flex>
      </Flex>
      {entry?.info.warning ? (
        <Text className='px-3' fontSize={12} type='warning'>
          {entry.info.warning}
        </Text>
      ) : null}
      {error ? (
        <Flex className='shrink-0 items-center gap-2 px-3 py-1'>
          <Text fontSize={12} role='alert' type='danger'>
            {error}
          </Text>
          {!missing ? (
            <Button size='small' onClick={retry}>
              重试
            </Button>
          ) : null}
        </Flex>
      ) : null}
      <div className='min-h-0 flex-1 overflow-hidden px-3 py-1'>
        {entry ? <TerminalView sessionId={entry.info.id} /> : null}
        {!entry && !error ? (
          <Text type='secondary' fontSize={12}>
            正在启动终端…
          </Text>
        ) : null}
      </div>
      {view?.exited ? (
        <Flex className='shrink-0 items-center gap-2 px-3 pb-1'>
          <Text type='secondary' fontSize={12}>
            终端已结束
          </Text>
          <Button size='small' onClick={retry}>
            重新打开
          </Button>
        </Flex>
      ) : null}
    </Flex>
  )
}
