import { NuqsAdapter } from 'nuqs/adapters/react-router/v8'
import { useLayoutEffect } from 'react'
import type { PropsWithChildren } from 'react'

import ThemeProviders from '@/layout/ThemeProviders'
import SpaTelemetry from '@/spa/SpaTelemetry'
import SpaUpdateNotifier from '@/spa/SpaUpdateNotifier'

/**
 * SPA 全局 Provider（主题、URL 状态和遥测）。
 * 认证会话通过 better-auth 客户端 Hook 获取，无需额外的 Provider。
 * 从原有的 Next App Router 外壳中提取，供 Vite 运行时使用。
 */
const AppLayer = ({ children }: PropsWithChildren) => {
  useLayoutEffect(() => {
    document.getElementById('loading-screen')?.remove()
  }, [])

  return (
    <ThemeProviders>
      <NuqsAdapter>
        {children}
        <SpaTelemetry />
        <SpaUpdateNotifier />
      </NuqsAdapter>
    </ThemeProviders>
  )
}

export default AppLayer
