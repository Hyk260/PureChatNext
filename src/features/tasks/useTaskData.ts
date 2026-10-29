import useSWR from 'swr'
import useSWRInfinite from 'swr/infinite'
import type { TaskDTO, TaskRunDTO, TaskRuntimeDTO } from '@pure/types'
import { useSession } from '@/libs/better-auth/client'
import { taskRequest } from './api'

const OPTIONS = {
  refreshInterval: 5_000,
  refreshWhenHidden: false,
  refreshWhenOffline: false,
  shouldRetryOnError: false,
}
const fetcher = <T>([path]: [string, string]) => taskRequest<T>(path)

export function useTaskList() {
  const { data: session } = useSession()
  const userId = session?.user?.id
  return useSWR<TaskDTO[]>(userId ? ['/api/tasks', userId] : null, fetcher, OPTIONS)
}

export function useTaskRuntime() {
  const { data: session } = useSession()
  const userId = session?.user?.id
  return useSWR<TaskRuntimeDTO>(userId ? ['/api/tasks/runtime', userId] : null, fetcher, OPTIONS)
}

export function useTaskDetail(id: string) {
  const { data: session } = useSession()
  const userId = session?.user?.id
  return useSWR<TaskDTO>(userId ? [`/api/tasks/${encodeURIComponent(id)}`, userId] : null, fetcher, OPTIONS)
}

export function useTaskRun(id: string, runId: string | null) {
  const { data: session } = useSession()
  const userId = session?.user?.id
  return useSWR<TaskRunDTO>(
    userId && runId ? [`/api/tasks/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}`, userId] : null,
    fetcher,
    OPTIONS
  )
}

export function useTaskRuns(id: string) {
  const { data: session } = useSession()
  const userId = session?.user?.id
  const resource = useSWRInfinite<TaskRunDTO[]>(
    (index, previous: TaskRunDTO[] | null) => {
      if (!userId || (previous && previous.length < 50)) return null
      const cursor =
        index > 0 && previous?.length ? `?before=${encodeURIComponent(previous[previous.length - 1]!.id)}` : ''
      return [`/api/tasks/${encodeURIComponent(id)}/runs${cursor}`, userId]
    },
    fetcher,
    OPTIONS
  )
  const items = [...new Map((resource.data ?? []).flat().map((run) => [run.id, run])).values()]
  const lastPage = resource.data?.at(-1)
  return { ...resource, items, hasMore: lastPage?.length === 50 }
}
