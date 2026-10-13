import { useEffect, useState } from 'react'

const SHOW_DELAY_MS = 250
const HIDE_DELAY_MS = 300

export function useDelayedLoading(loading: boolean) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (loading === visible) return

    const timer = window.setTimeout(
      () => setVisible(loading),
      loading ? SHOW_DELAY_MS : HIDE_DELAY_MS
    )

    return () => window.clearTimeout(timer)
  }, [loading, visible])

  return visible
}
