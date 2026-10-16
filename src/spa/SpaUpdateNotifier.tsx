import { Button, Flex } from 'antd'
import { sessionStg } from '@pure/utils/storage'
import { useEffect, useRef } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
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
 * 按钮使用 antd（而非 `@pure/ui`），因为通知 Portal 位于共享的
 * `ConfigProvider` / `MotionProvider` 之外。
 */
const SpaUpdateNotifier = ({
  preview = isSpaUpdatePreview(),
  enabled = !import.meta.env.DEV || preview,
}: SpaUpdateNotifierProps) => {
  const { notification } = useApp()
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
      notification.open({
        actions: (
          <Flex gap={8}>
            <Button
              onClick={() => {
                rememberDismissed(remote)
                notification.destroy(SPA_UPDATE_NOTIFICATION_KEY)
              }}
            >
              稍后再说
            </Button>
            <Button type='primary' onClick={() => location.reload()}>
              立即刷新
            </Button>
          </Flex>
        ),
        duration: false,
        key: SPA_UPDATE_NOTIFICATION_KEY,
        onClose: () => rememberDismissed(remote),
        title: '检测到系统有新版本发布，是否立即刷新页面？',
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
      notification.destroy(SPA_UPDATE_NOTIFICATION_KEY)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled, notification, preview])

  return null
}

export default SpaUpdateNotifier
