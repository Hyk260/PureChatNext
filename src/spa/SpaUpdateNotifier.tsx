import { Button, Flex } from 'antd'
import { sessionStg } from '@pure/utils/storage'
import { useEffect, useRef } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
import {
  SPA_UPDATE_DISMISS_KEY,
  SPA_UPDATE_NOTIFICATION_KEY,
  checkForSpaUpdate,
  isSpaUpdatePreview,
} from '@/spa/spaUpdateCheck'

type SpaUpdateNotifierProps = {
  /** Production default: skip Vite HMR. Tests pass `true` to exercise the listener. */
  enabled?: boolean
  /** Force the toast (local `VITE_SPA_UPDATE_PREVIEW` / `?spaUpdatePreview=1`). */
  preview?: boolean
}

/**
 * When a long-lived SPA tab becomes visible, compare the document buildTime meta
 * with `/api/version`. If the deployed shell is newer, prompt a reload.
 *
 * Local preview (force the toast without a new deploy): `VITE_SPA_UPDATE_PREVIEW=1`
 * or open any SPA URL with `?spaUpdatePreview=1`.
 *
 * Buttons use antd (not `@pure/ui`) because the notification portal sits outside
 * the shared `ConfigProvider` / `MotionProvider`.
 */
const SpaUpdateNotifier = ({
  preview = isSpaUpdatePreview(),
  enabled = !import.meta.env.DEV || preview,
}: SpaUpdateNotifierProps) => {
  const { notification } = useApp()
  const isShowingRef = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const notify = (remote: string) => {
      isShowingRef.current = true
      notification.open({
        description: (
          <Flex gap={8}>
            <Button onClick={() => notification.destroy(SPA_UPDATE_NOTIFICATION_KEY)}>稍后再说</Button>
            <Button type='primary' onClick={() => location.reload()}>
              立即刷新
            </Button>
          </Flex>
        ),
        duration: 6,
        key: SPA_UPDATE_NOTIFICATION_KEY,
        message: '检测到系统有新版本发布，是否立即刷新页面？',
        onClose: () => {
          isShowingRef.current = false
          if (preview) return
          sessionStg.setString(SPA_UPDATE_DISMISS_KEY, remote)
        },
      })
    }

    if (preview) {
      notify('preview')
      return
    }

    const runCheck = async () => {
      if (document.visibilityState !== 'visible') return

      const result = await checkForSpaUpdate({ isShowing: isShowingRef.current })
      if (!result.show || !result.remote) return

      notify(result.remote)
    }

    const onVisibilityChange = () => {
      void runCheck()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled, notification, preview])

  return null
}

export default SpaUpdateNotifier
