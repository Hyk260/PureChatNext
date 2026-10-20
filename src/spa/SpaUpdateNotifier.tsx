import { toast } from '@lobehub/ui'
import { sessionStg } from '@pure/utils/storage'
import { useEffect, useRef } from 'react'

import { isDesktopRenderer } from '@/utils/desktopAuth'
import {
  SPA_UPDATE_DISMISS_KEY,
  SPA_UPDATE_NOTIFICATION_KEY,
  checkForSpaUpdate,
  isSpaUpdatePreview,
} from '@/spa/spaUpdateCheck'

type SpaUpdateNotifierProps = {
  /** 生产环境默认跳过 Vite HMR；测试传入 `true` 以验证监听器。 */
  enabled?: boolean
  /** 强制显示提示（本地设置 `VITE_SPA_UPDATE_PREVIEW` 或使用 `?spaUpdatePreview=1`）。 */
  preview?: boolean
}

/**
 * 长时间打开的 SPA 标签页重新变为可见时，将文档中的 buildTime 元信息
 * 与 `/api/version` 比较。如果已部署的外壳更新，则提示重新加载。
 *
 * 本地预览（无需重新部署即可强制显示提示）：设置 `VITE_SPA_UPDATE_PREVIEW=1`，
 * 或在任意 SPA 地址后添加 `?spaUpdatePreview=1`。
 *
 */
const SpaUpdateNotifier = ({
  preview = isSpaUpdatePreview(),
  enabled = !import.meta.env.DEV || preview,
}: SpaUpdateNotifierProps) => {
  const isShowingRef = useRef(false)

  useEffect(() => {
    if (!enabled || isDesktopRenderer()) return
    let cancelled = false
    let checking = false

    const rememberDismissed = (remote: string) => {
      isShowingRef.current = false
      if (preview) return
      sessionStg.setString(SPA_UPDATE_DISMISS_KEY, remote)
    }

    const notify = (remote: string) => {
      isShowingRef.current = true
      toast({
        actions: [
          {
            label: '稍后再说',
            onClick: () => {
              rememberDismissed(remote)
              toast.dismiss(SPA_UPDATE_NOTIFICATION_KEY)
            },
            variant: 'secondary',
          },
          {
            label: '立即刷新',
            onClick: () => location.reload(),
            variant: 'primary',
          },
        ],
        duration: 0,
        id: SPA_UPDATE_NOTIFICATION_KEY,
        onClose: () => rememberDismissed(remote),
        placement: 'top-right',
        title: '检测到新版本发布，是否立即刷新页面？',
        type: 'info',
      })
    }

    const runCheck = async () => {
      if (document.visibilityState !== 'visible' || checking) return

      if (preview) {
        if (!isShowingRef.current) notify('preview')
        return
      }

      checking = true
      try {
        const result = await checkForSpaUpdate({ isShowing: isShowingRef.current })
        if (cancelled || !result.show || !result.remote) return
        notify(result.remote)
      } finally {
        checking = false
      }
    }

    const onVisibilityChange = () => {
      runCheck()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    if (preview) notify('preview')

    return () => {
      cancelled = true
      isShowingRef.current = false
      toast.dismiss(SPA_UPDATE_NOTIFICATION_KEY)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled, preview])

  return null
}

export default SpaUpdateNotifier
