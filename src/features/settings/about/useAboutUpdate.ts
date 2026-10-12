import { useEffect, useEffectEvent, useRef, useState } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
import { CURRENT_VERSION } from '@/const/version'
import { getDesktopApi } from '@/types/desktop'
import type { DesktopUpdatePreferences, DesktopUpdateState, DesktopUpdateStatus } from '@/types/desktopUpdater'
import { getUpdateChannel } from '@/types/desktopUpdater'

import { acceptUpdateSnapshot } from './updatePresentation'

export function useAboutUpdate() {
  const { message, modal } = useApp()
  const api = getDesktopApi()
  const isDesktop = Boolean(api)
  const [desktopState, setDesktopState] = useState<DesktopUpdateState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const busyRef = useRef(false)
  const aliveRef = useRef(true)
  const promptedRef = useRef<string | null>(null)

  const receive = (next: DesktopUpdateState) => {
    if (aliveRef.current) setDesktopState((previous) => acceptUpdateSnapshot(previous, next))
  }

  useEffect(() => {
    aliveRef.current = true
    if (!api)
      return () => {
        aliveRef.current = false
      }
    const unsubscribe = api.updater.onStateChange((next) => {
      setDesktopState((previous) => acceptUpdateSnapshot(previous, next))
    })
    api.updater
      .getState()
      .then((next) => {
        if (aliveRef.current) setDesktopState((previous) => acceptUpdateSnapshot(previous, next))
      })
      .catch(() => {
        if (aliveRef.current) setLoadError('无法读取客户端更新状态，请重新打开页面后重试。')
      })
    return () => {
      aliveRef.current = false
      unsubscribe()
    }
  }, [api])

  const confirmInstall = () => {
    if (!api) return
    modal.confirm({
      title: `重启并安装 v${desktopState?.release?.version || ''}？`,
      content: '应用将重启，进行中的聊天和工具任务会被中断。请先完成当前操作。',
      okText: '重启并安装',
      cancelText: '稍后再说',
      onOk: async () => {
        try {
          await api.updater.install()
        } catch (error) {
          message.error(error instanceof Error ? error.message : '安装失败，请重试。')
          throw error
        }
      },
    })
  }

  const showInstallConfirmation = useEffectEvent(confirmInstall)

  useEffect(() => {
    if (!desktopState?.manual || desktopState.status !== 'ready') return
    const promptKey = `${getUpdateChannel(desktopState.preferences)}:${desktopState.release?.version}`
    if (promptedRef.current === promptKey) return
    promptedRef.current = promptKey
    // This effect reacts to downloaded state, not to the click which started the check.
    showInstallConfirmation()
  }, [desktopState])

  const check = async () => {
    if (!api || busyRef.current) return
    busyRef.current = true
    setPending(true)
    try {
      receive(await api.updater.check())
    } catch (error) {
      message.error(error instanceof Error ? error.message : '检查更新失败，请重试。')
    } finally {
      busyRef.current = false
      if (aliveRef.current) setPending(false)
    }
  }

  const savePreferences = async (patch: Partial<DesktopUpdatePreferences>) => {
    if (!api || !desktopState || busyRef.current) return
    busyRef.current = true
    setPending(true)
    try {
      receive(await api.updater.setPreferences({ ...desktopState.preferences, ...patch }))
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存更新设置失败。')
    } finally {
      busyRef.current = false
      if (aliveRef.current) setPending(false)
    }
  }

  const clearCache = async () => {
    if (!api || !desktopState?.developmentCachePath || busyRef.current) return
    busyRef.current = true
    setPending(true)
    try {
      receive(await api.updater.clearCache())
      message.success('下载安装包缓存已清理')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '清理更新缓存失败，请重试。')
    } finally {
      busyRef.current = false
      if (aliveRef.current) setPending(false)
    }
  }

  const setAutoUpdate = (enabled: boolean) => savePreferences({ autoUpdate: enabled })

  let status: DesktopUpdateStatus = desktopState?.status || 'idle'
  if (pending && !desktopState) status = 'checking'
  const version = isDesktop ? desktopState?.currentVersion : CURRENT_VERSION

  return {
    isDesktop,
    desktopState,
    status,
    version,
    pending,
    loadError,
    feedback: desktopState?.message || loadError,
    autoUpdate: desktopState?.preferences.autoUpdate ?? true,
    check,
    clearCache,
    confirmInstall,
    setAutoUpdate,
    savePreferences,
  }
}
