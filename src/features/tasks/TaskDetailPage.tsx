'use client'

import { Button, Text } from '@lobehub/ui'
import { Flex } from '@pure/ui'
import { CalendarClock, ChevronRight, Pause, Pencil, Play, Square } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { formatTaskSchedule } from '@pure/utils/taskSchedule'

import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { patchTask, runTask, stopRun } from './api'
import { TaskEditor } from './TaskEditor'
import { TaskHeader } from './TaskHeader'
import { TaskPriorityMenu, TaskStatusMenu } from './TaskMenus'
import { TaskRunHistory } from './TaskRunHistory'
import { formatTaskDate, TASK_CHANNEL_LABELS } from './presentation'
import { useTaskActions } from './useTaskActions'
import { useTaskDetail, useTaskRuntime } from './useTaskData'

export default function TaskDetailPage() {
  const { id = '' } = useParams()
  const [, setParams] = useSearchParams()
  const detail = useTaskDetail(id)
  const runtime = useTaskRuntime()
  const [editing, setEditing] = useState(false)
  const agents = useAgentsStore((state) => state.agents)
  const fetchAgents = useAgentsStore((state) => state.fetchAgents)
  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])
  const refresh = () => Promise.all([detail.mutate(), runtime.mutate()])
  const { busy, perform } = useTaskActions(refresh)
  const task = detail.data
  const terminal = task?.status === 'completed' || task?.status === 'canceled'
  const activeRun = task?.activeRun
  const canRun = Boolean(runtime.data?.enabled) && !terminal && !activeRun && !busy
  const canToggleSchedule = !busy && !terminal && Boolean(task?.enabled || runtime.data?.enabled)
  const agent = agents.find((item) => item.id === task?.agentId)
  const channelLabel = task?.channels.map((channel) => TASK_CHANNEL_LABELS[channel]).join('、') || '不推送'

  return (
    <Flex className='size-full min-h-0 flex-col'>
      <TaskHeader>
        <Link className='shrink-0 text-sm text-muted-foreground no-underline' to='/tasks'>
          全部任务
        </Link>
        <ChevronRight size={14} className='shrink-0 text-muted-foreground' />
        <Text as='span' className='truncate text-sm'>
          {task?.title ?? '任务详情'}
        </Text>
      </TaskHeader>
      <main className='min-h-0 flex-1 overflow-y-auto px-5 pb-12 pt-4 sm:px-10'>
        {detail.isLoading && (
          <Text as='p' className='text-sm text-muted-foreground'>
            正在读取任务…
          </Text>
        )}
        {detail.error && (
          <Text as='p' role='alert' type='danger' className='text-sm'>
            {detail.error.message}
          </Text>
        )}
        {task && (
          <div className='mx-auto max-w-6xl space-y-8'>
            <div className='space-y-5'>
              <Flex className='flex-wrap items-start justify-between gap-4'>
                <Text as='h1' className='m-0 min-w-0 break-words text-2xl font-semibold'>
                  {task.title}
                </Text>
                <Flex className='flex-wrap items-center gap-2'>
                  <TaskPriorityMenu
                    value={task.priority}
                    disabled={busy}
                    onChange={(priority) => perform(() => patchTask(id, { priority }))}
                  />
                  <TaskStatusMenu
                    value={task.status}
                    disabled={busy}
                    onChange={(status) => perform(() => patchTask(id, { status }))}
                  />
                </Flex>
              </Flex>
              <Flex className='flex-wrap items-center gap-2'>
                <Button
                  type='primary'
                  disabled={!canRun}
                  loading={busy}
                  onClick={() =>
                    perform(async () => {
                      const run = await runTask(id)
                      setParams({ run: run.id })
                    }, '已加入云端执行队列')
                  }
                >
                  <Play size={15} />
                  立即运行
                </Button>
                {activeRun && (
                  <Button
                    danger
                    disabled={busy}
                    onClick={() => perform(() => stopRun(id, activeRun.id), '已停止本次运行')}
                  >
                    <Square size={14} />
                    停止本次运行
                  </Button>
                )}
                <Button
                  disabled={!canToggleSchedule}
                  onClick={() =>
                    perform(() => patchTask(id, { enabled: !task.enabled }), task.enabled ? '定时已暂停' : '定时已启用')
                  }
                >
                  {task.enabled ? <Pause size={15} /> : <Play size={15} />}
                  {task.enabled ? '暂停定时' : '启用定时'}
                </Button>
                <Button disabled={busy} onClick={() => setEditing(true)}>
                  <Pencil size={14} />
                  编辑
                </Button>
                <Text as='span' className='text-sm text-muted-foreground'>
                  {agent?.avatar ?? '🤖'} {agent?.title ?? '助理不可用'} · {task.model}
                </Text>
              </Flex>
              <Flex className='flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground'>
                <Text as='span' className='flex items-center gap-1.5 text-inherit'>
                  <CalendarClock size={15} />
                  {formatTaskSchedule(task.schedule)}
                </Text>
                <Text as='span' className='text-inherit'>
                  {task.schedule.timezone}
                </Text>
                <Text as='span' className='text-inherit'>
                  {task.enabled ? `下次运行：${formatTaskDate(task.nextRunAt, task.schedule.timezone)}` : '定时已暂停'}
                </Text>
                <Text as='span' className='text-inherit'>
                  推送：{channelLabel}
                </Text>
              </Flex>
              {runtime.data?.reason && (
                <Text as='p' className='rounded-lg bg-muted p-3 text-sm text-muted-foreground'>
                  {runtime.data.reason}
                </Text>
              )}
              {terminal && (
                <Text as='p' className='text-sm text-muted-foreground'>
                  此任务已停止排期。恢复为待办后，可手动运行或重新启用定时。
                </Text>
              )}
            </div>
            <section className='space-y-3'>
              <Text as='h2' className='m-0 text-base font-semibold'>
                执行说明
              </Text>
              <Text as='p' className='m-0 whitespace-pre-wrap break-words text-sm/7'>
                {task.instruction}
              </Text>
            </section>
            <TaskRunHistory taskId={id} timezone={task.schedule.timezone} enabled={Boolean(runtime.data?.enabled)} />
          </div>
        )}
      </main>
      {editing && task && (
        <TaskEditor
          task={task}
          agents={agents}
          availability={runtime.data?.channels ?? []}
          onClose={() => setEditing(false)}
          onSave={async (input) => {
            await patchTask(id, input)
            await refresh()
          }}
        />
      )}
    </Flex>
  )
}
