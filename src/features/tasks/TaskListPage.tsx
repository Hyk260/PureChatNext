'use client'

import { ActionIcon, Button, Input, Segmented, Select, Text } from '@lobehub/ui'
import { Flex } from '@pure/ui'
import { CalendarClock, Clock, ListTodo, LoaderCircle, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import type { TaskDTO } from '@pure/types'
import { formatTaskSchedule } from '@pure/utils/taskSchedule'

import type { AgentListItem } from '@/const/home/agents'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { createScheduledTask, patchTask } from './api'
import { TaskAssigneePicker } from './TaskAssigneePicker'
import { TaskEditor } from './TaskEditor'
import { TaskHeader } from './TaskHeader'
import { TaskPriorityMenu, TaskStatusMenu } from './TaskMenus'
import { formatTaskDate, PRIORITY_FILTERS, RUN_LABELS, STATUS_FILTERS, TASK_COLLECTIONS } from './presentation'
import { useTaskActions } from './useTaskActions'
import { useTaskList, useTaskRuntime } from './useTaskData'

function TaskRow({
  task,
  agents,
  busy,
  update,
}: {
  task: TaskDTO
  agents: AgentListItem[]
  busy: boolean
  update: (input: Parameters<typeof patchTask>[1]) => void
}) {
  const latest = task.activeRun ?? task.latestRun
  const runLabel = latest ? RUN_LABELS[latest.status] : '尚未运行'
  return (
    <li className='flex items-center gap-1 border-b border-dashed border-border py-4 sm:gap-3'>
      <TaskPriorityMenu compact value={task.priority} disabled={busy} onChange={(priority) => update({ priority })} />
      <TaskStatusMenu compact value={task.status} disabled={busy} onChange={(status) => update({ status })} />
      <Link
        className='flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-inherit no-underline'
        to={`/tasks/${task.id}`}
      >
        <Text as='span' className='min-w-32 flex-1 truncate font-medium'>
          {task.title}
        </Text>
        <Text as='span' className='text-xs text-muted-foreground'>
          {runLabel}
        </Text>
        <Text
          as='span'
          className='flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs text-muted-foreground'
        >
          <Clock size={13} />
          {formatTaskSchedule(task.schedule)}
        </Text>
      </Link>
      <TaskAssigneePicker
        agents={agents}
        compact
        value={task.agentId}
        disabled={busy}
        onChange={(agentId) => update({ agentId })}
      />
      <Text as='span' className='hidden shrink-0 text-xs text-muted-foreground xl:block'>
        {task.enabled ? `下次 ${formatTaskDate(task.nextRunAt, task.schedule.timezone)}` : '定时已暂停'}
      </Text>
    </li>
  )
}

export default function TaskListPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const collection = params.get('collection') === 'manual' ? 'manual' : 'scheduled'
  const list = useTaskList()
  const runtime = useTaskRuntime()
  const agents = useAgentsStore((state) => state.agents)
  const fetchAgents = useAgentsStore((state) => state.fetchAgents)
  const [creating, setCreating] = useState(false)
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [query, setQuery] = useState('')
  const refresh = () => Promise.all([list.mutate(), runtime.mutate()])
  const { busy, perform } = useTaskActions(refresh)
  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])
  const filtered = useMemo(
    () =>
      (list.data ?? []).filter((task) => {
        if (status !== 'all' && task.status !== status) return false
        if (priority !== 'all' && String(task.priority) !== priority) return false
        return task.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
      }),
    [list.data, priority, query, status]
  )
  const createDisabled = !runtime.data?.enabled
  const showEmpty = !list.isLoading && !list.error && filtered.length === 0

  return (
    <Flex className='size-full min-h-0 flex-col'>
      <TaskHeader
        actions={
          collection === 'scheduled' && (
            <ActionIcon
              aria-label='新建定时任务'
              icon={Plus}
              disabled={createDisabled}
              title={runtime.data?.reason ?? '新建定时任务'}
              onClick={() => setCreating(true)}
            />
          )
        }
      >
        <Segmented
          value={collection}
          options={TASK_COLLECTIONS}
          onChange={(value) => setParams({ collection: value })}
        />
      </TaskHeader>
      {collection === 'manual' ? (
        <main className='flex-col-center flex-1 gap-3 p-8 text-center'>
          <ListTodo className='text-muted-foreground' size={32} />
          {/* <Text as='h1' className='m-0 text-lg font-semibold'>
            任务
          </Text> */}
          <Text as='p' className='m-0 text-sm text-muted-foreground'>
            普通任务即将推出，先用定时任务安排助理自动执行。
          </Text>
          <Button onClick={() => setParams({ collection: 'scheduled' })}>查看定时任务</Button>
        </main>
      ) : (
        <main className='min-h-0 flex-1 overflow-y-auto px-4 pb-8 sm:px-7'>
          {runtime.data?.reason && (
            <Text as='p' role='status' className='rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground'>
              {runtime.data.reason}
            </Text>
          )}
          {runtime.error && (
            <Text as='p' role='alert' type='danger' className='text-sm'>
              无法读取调度器状态，请刷新重试。
            </Text>
          )}
          <Flex className='flex-wrap items-center gap-2 py-4'>
            <Input
              aria-label='筛选任务'
              className='max-w-64'
              placeholder='筛选任务…'
              prefix={<Search size={15} />}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Select
              aria-label='状态筛选'
              value={status}
              options={STATUS_FILTERS}
              size='small'
              onChange={(next) => {
                if (typeof next === 'string') setStatus(next)
              }}
            />
            <Select
              aria-label='优先级筛选'
              value={priority}
              options={PRIORITY_FILTERS}
              size='small'
              onChange={(next) => {
                if (typeof next === 'string') setPriority(next)
              }}
            />
          </Flex>
          <Flex className='items-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground'>
            <CalendarClock size={17} />
            定时
            <Text as='span' className='text-xs text-inherit'>
              {filtered.length}
            </Text>
          </Flex>
          {list.isLoading && (
            <Flex className='flex-center gap-2 py-16 text-sm text-muted-foreground'>
              <LoaderCircle className='animate-spin' size={18} />
              加载任务…
            </Flex>
          )}
          {list.error && (
            <div role='alert' className='space-y-3 py-12 text-center'>
              <Text as='p' type='danger' className='text-sm'>
                {list.error.message}
              </Text>
              <Button onClick={() => perform(refresh)}>重新加载</Button>
            </div>
          )}
          {showEmpty && (
            <Flex className='flex-col-center gap-3 py-24 text-center'>
              <CalendarClock size={34} className='text-muted-foreground' />
              <Text as='h2' className='m-0 text-base font-medium'>
                暂无定时任务
              </Text>
              <Text as='p' className='m-0 max-w-md text-sm text-muted-foreground'>
                安排每日简报、天气查询或提醒，由云端助理定时执行。
              </Text>
              <Button type='primary' disabled={createDisabled} onClick={() => setCreating(true)}>
                <Plus size={16} />
                新建定时任务
              </Button>
            </Flex>
          )}
          {!list.error && (
            <ul className='m-0 list-none p-0'>
              {filtered.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  agents={agents}
                  busy={busy}
                  update={(patch) => perform(() => patchTask(task.id, patch))}
                />
              ))}
            </ul>
          )}
        </main>
      )}
      {creating && (
        <TaskEditor
          agents={agents}
          availability={runtime.data?.channels ?? []}
          onClose={() => setCreating(false)}
          onSave={async (input) => {
            const task = await createScheduledTask(input)
            await list.mutate()
            navigate(`/tasks/${task.id}`)
          }}
        />
      )}
    </Flex>
  )
}
