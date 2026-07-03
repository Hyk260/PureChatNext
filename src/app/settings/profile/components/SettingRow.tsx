import type { ReactNode } from 'react'

interface SettingRowProps {
  action?: ReactNode
  children?: ReactNode
  label: string
  vertical?: boolean
}

export function SettingRow({ action, children, label, vertical }: SettingRowProps) {
  if (vertical) {
    return (
      <div className="px-5 py-4">
        <div className="mb-3 text-sm font-medium text-foreground">{label}</div>
        {children}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    )
  }

  return (
    <div className="flex min-h-14 items-center justify-between gap-4 px-5 py-3.5">
      <span className="shrink-0 text-sm font-medium text-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
        {children}
        {action}
      </div>
    </div>
  )
}
