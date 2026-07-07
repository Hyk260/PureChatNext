import { Text } from '@lobehub/ui'
import type { ReactNode } from 'react'

interface SettingRowProps {
  action?: ReactNode
  children?: ReactNode
  label: string
  labelSlot?: ReactNode
  vertical?: boolean
}

export function SettingRow({ action, children, label, labelSlot, vertical }: SettingRowProps) {
  if (vertical) {
    return (
      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="shrink-0 md:w-40">
          {labelSlot ?? (
            <Text strong fontSize={14}>
              {label}
            </Text>
          )}
        </div>
        <div className="min-w-0 flex-1">{children}</div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    )
  }

  return (
    <div className="flex min-h-12 flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:gap-6">
      <div className="shrink-0 md:w-40">
        {labelSlot ?? (
          <Text strong fontSize={14}>
            {label}
          </Text>
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        {children}
        {action ? <div className="ms-auto shrink-0">{action}</div> : null}
      </div>
    </div>
  )
}
