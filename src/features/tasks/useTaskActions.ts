import { useState } from 'react'
import { toast } from '@lobehub/ui'
import { getErrorMessage } from '@pure/utils/error'

export function useTaskActions(refresh: () => Promise<unknown>) {
  const [busy, setBusy] = useState(false)
  const perform = async (action: () => Promise<unknown>, message?: string) => {
    setBusy(true)
    try {
      await action()
      await refresh()
      if (message) toast.success(message)
    } catch (error) {
      toast.error(getErrorMessage(error, '操作失败，请稍后重试'))
    } finally {
      setBusy(false)
    }
  }
  return { busy, perform }
}
