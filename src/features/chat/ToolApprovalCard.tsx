'use client'

import { AlertTriangle, Check, X } from 'lucide-react'

type ToolApprovalCardProps = {
  args: Record<string, unknown>
  toolName: string
  onDecision: (approved: boolean) => void
}

const formatArgs = (args: Record<string, unknown>) =>
  Object.entries(args)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join('\n')

export default function ToolApprovalCard({ args, toolName, onDecision }: ToolApprovalCardProps) {
  return (
    <div className='my-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm'>
      <div className='flex items-center gap-2 font-medium text-amber-700 dark:text-amber-300'>
        <AlertTriangle size={16} />
        <span>需要批准：{toolName}</span>
      </div>
      <pre className='mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-background/70 p-2 text-xs text-muted-foreground'>
        {formatArgs(args)}
      </pre>
      <div className='mt-3 flex gap-2'>
        <button
          className='inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground'
          type='button'
          onClick={() => onDecision(true)}
        >
          <Check size={14} />
          批准
        </button>
        <button
          className='inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs text-foreground'
          type='button'
          onClick={() => onDecision(false)}
        >
          <X size={14} />
          拒绝
        </button>
      </div>
    </div>
  )
}
