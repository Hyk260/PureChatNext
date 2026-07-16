'use client'

import { memo, useEffect } from 'react'

interface ReactScanProps {
  apiKey: string
}

const ReactScan = memo(({ apiKey }: ReactScanProps) => {
  useEffect(() => {
    if (!apiKey) return

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/react-scan/dist/auto.global.js'
    script.dataset.apiKey = apiKey
    script.dataset.url = 'https://monitoring.react-scan.com/api/v1/ingest'
    script.async = true
    document.head.appendChild(script)

    return () => {
      script.remove()
    }
  }, [apiKey])

  return null
})

ReactScan.displayName = 'ReactScan'

export default ReactScan
