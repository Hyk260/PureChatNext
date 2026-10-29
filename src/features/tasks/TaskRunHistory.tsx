'use client'

import { Button, confirmModal, Markdown, Text, toast } from '@lobehub/ui'
import { Flex } from '@pure/ui'
import { LoaderCircle, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import type { TaskRunDTO } from '@pure/types'
import { getErrorMessage } from '@pure/utils/error'

import { deleteTaskRun, resendTaskDelivery } from './api'
import { DELIVERY_LABELS, formatTaskDate, OPEN_RUN_STATUSES, RUN_LABELS, TASK_CHANNEL_LABELS } from './presentation'
import { useTaskActions } from './useTaskActions'
import { useTaskRun, useTaskRuns } from './useTaskData'

const DELIVERY_BUSY = new Set(['sending', 'pending', 'retry'])

function RunResult({
  run,
  taskId,
  enabled,
  refresh,
}: {
  run: TaskRunDTO
  taskId: string
  enabled: boolean
  refresh: () => Promise<unknown>
}) {
  const { busy, perform } = useTaskActions(refresh)
  const inProgress = OPEN_RUN_STATUSES.has(run.status)
  return (
    <article className='min-w-0 flex-1 space-y-5'>
      <Flex className='flex-between-wrap gap-2'>
        <Text as='h3' className='m-0 text-base font-semibold'>
          {RUN_LABELS[run.status]}
        </Text>
        <Text as='span' className='text-xs text-muted-foreground'>
          {run.snapshot.agentTitle ?? '助理'} · {run.snapshot.model}
        </Text>
      </Flex>
      {inProgress && (
        <Text as='p' className='flex items-center gap-2 text-sm text-muted-foreground'>
          <LoaderCircle className='animate-spin' size={15} />
          云端正在处理，关闭页面不会中断任务。
        </Text>
      )}
      {run.error && (
        <Text as='p' role='status' className='rounded-lg bg-muted p-3 text-sm text-muted-foreground'>
          {run.error}
        </Text>
      )}
      {run.result && (
        <div className='min-w-0 rounded-xl border border-border p-4 sm:p-6'>
          <Markdown allowHtml={false} enableHtmlPreview={false} enableImageGallery={false} fontSize={14}>
            {run.result}
          </Markdown>
        </div>
      )}
      {run.deliveries.length > 0 && (
        <section className='space-y-2'>
          <Text as='h4' className='m-0 text-sm font-medium'>
            消息推送
          </Text>
          {run.deliveries.map((delivery) => {
            const canResend = !busy && enabled && !DELIVERY_BUSY.has(delivery.status)
            return (
              <div key={delivery.id} className='rounded-lg border border-border p-3'>
                <Flex className='flex-between-wrap gap-2'>
                  <Text as='span' className='text-sm'>
                    {TASK_CHANNEL_LABELS[delivery.platform]} · {DELIVERY_LABELS[delivery.status]}
                  </Text>
                  <Button
                    size='small'
                    type='text'
                    disabled={!canResend}
                    onClick={() => perform(() => resendTaskDelivery(taskId, delivery.id), '已安排重新推送')}
                  >
                    {delivery.status === 'unknown' ? '核实后重新推送' : '重新推送'}
                  </Button>
                </Flex>
                {delivery.error && (
                  <Text as='p' className='mb-0 text-xs text-muted-foreground'>
                    {delivery.error}
                  </Text>
                )}
              </div>
            )
          })}
          <Text as='p' className='m-0 text-xs text-muted-foreground'>
            QQ 主动推送不受 60 分钟被动窗口影响，但受开放平台权限和频率限制；重新推送不会再次执行助理。
            “平台已接受”表示接口请求成功，实际送达以消息客户端为准。
          </Text>
        </section>
      )}
      <details className='text-xs text-muted-foreground'>
        <summary className='cursor-pointer'>执行信息</summary>
        <dl className='grid grid-cols-[auto_1fr] gap-x-4 gap-y-2'>
          <dt>服务商 / 模型</dt>
          <dd className='m-0 break-all'>
            {run.snapshot.provider} / {run.snapshot.model}
          </dd>
          <dt>尝试次数</dt>
          <dd className='m-0'>{run.attempts}</dd>
          <dt>开始</dt>
          <dd className='m-0'>{formatTaskDate(run.startedAt, run.snapshot.schedule.timezone)}</dd>
          <dt>结束</dt>
          <dd className='m-0'>{formatTaskDate(run.completedAt, run.snapshot.schedule.timezone)}</dd>
        </dl>
        {run.diagnostics && (
          <pre className='max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3'>
            {JSON.stringify(run.diagnostics, null, 2)}
          </pre>
        )}
      </details>
    </article>
  )
}

export function TaskRunHistory({ taskId, timezone, enabled }: { taskId: string; timezone: string; enabled: boolean }) {
  const runs = useTaskRuns(taskId)
  const [params, setParams] = useSearchParams()
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null)
  const selectedId = params.get('run')
  const selected = useTaskRun(taskId, selectedId)
  const current = selectedId ? selected.data : runs.items[0]
  const refresh = () => Promise.all([runs.mutate(), selected.mutate()])
  const historyError = runs.error || selected.error

  const confirmDeleteRun = (run: TaskRunDTO) => {
    if (deletingRunId || OPEN_RUN_STATUSES.has(run.status)) return
    const nextRunId = runs.items.find((item) => item.id !== run.id)?.id

    confirmModal({
      cancelText: '取消',
      content: '删除后无法恢复，这次运行关联的消息推送记录也会一起删除。',
      okButtonProps: { danger: true },
      okText: '删除运行记录',
      title: '删除这条运行记录？',
      onOk: async () => {
        setDeletingRunId(run.id)
        try {
          await deleteTaskRun(taskId, run.id)
          if (selectedId === run.id) setParams(nextRunId ? { run: nextRunId } : {}, { replace: true })
          await runs.mutate()
          toast.success('运行记录已删除')
        } catch (error) {
          toast.error(getErrorMessage(error, '删除运行记录失败'))
          throw error
        } finally {
          setDeletingRunId(null)
        }
      },
    })
  }

  return (
    <section className='space-y-4'>
      <Flex className='flex-between'>
        <Text as='h2' className='m-0 text-base font-semibold'>
          运行记录
        </Text>
        <Text as='span' className='text-xs text-muted-foreground'>
          每次独立执行 · {timezone}
        </Text>
      </Flex>
      {historyError && (
        <Text as='p' role='alert' type='danger' className='text-sm'>
          {historyError.message}
        </Text>
      )}
      {runs.isLoading && (
        <Text as='p' className='text-sm text-muted-foreground'>
          正在读取运行记录…
        </Text>
      )}
      {!runs.isLoading && !runs.items.length && (
        <Text as='p' className='py-8 text-sm text-muted-foreground'>
          尚未运行。到达排期后会自动执行，也可以点击“立即运行”验证任务。
        </Text>
      )}
      <Flex className='flex-col gap-6 lg:flex-row'>
        {runs.items.length > 0 && (
          <Flex className='shrink-0 flex-col gap-1 lg:w-52'>
            {runs.items.map((run) => {
              const active = OPEN_RUN_STATUSES.has(run.status)
              const selectedRun = current?.id === run.id
              return (
                <Flex key={run.id} className='min-w-0 items-center gap-1'>
                  <Button
                    type={selectedRun ? 'default' : 'text'}
                    className='h-auto min-w-0 flex-1 justify-start'
                    onClick={() => setParams({ run: run.id })}
                  >
                    <Text as='span' className='flex flex-col items-start gap-1 py-1'>
                      <Text as='span' className='text-xs'>
                        {formatTaskDate(run.scheduledAt, timezone)}
                      </Text>
                      <Text as='span' className='text-xs text-muted-foreground'>
                        {RUN_LABELS[run.status]} · {run.source === 'manual' ? '手动' : '定时'}
                      </Text>
                    </Text>
                  </Button>
                  <Button
                    aria-label={`删除 ${formatTaskDate(run.scheduledAt, timezone)} 运行记录`}
                    danger
                    disabled={Boolean(deletingRunId) || active}
                    loading={deletingRunId === run.id}
                    size='small'
                    title={active ? '运行中的记录不能删除' : '删除运行记录'}
                    type='text'
                    onClick={() => confirmDeleteRun(run)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </Flex>
              )
            })}
            {runs.hasMore && (
              <Button type='text' size='small' loading={runs.isValidating} onClick={() => runs.setSize(runs.size + 1)}>
                加载更早记录
              </Button>
            )}
          </Flex>
        )}
        {selectedId && selected.isLoading && (
          <Text as='p' className='text-sm text-muted-foreground'>
            正在读取本次结果…
          </Text>
        )}
        {current && <RunResult key={current.id} run={current} taskId={taskId} enabled={enabled} refresh={refresh} />}
      </Flex>
    </section>
  )
}
