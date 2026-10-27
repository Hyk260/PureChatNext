export type CopyState = 'idle' | 'copied' | 'failed'

export type RunState = {
  durationMs: number
  status: number
  submittedAt: string
}

export type SummaryItem = {
  label: string
  value: string
}

export const COPY_FEEDBACK_MS = 1600

export const COPY_LABEL: Record<CopyState, string> = {
  idle: '复制',
  copied: '已复制',
  failed: '复制失败',
}
