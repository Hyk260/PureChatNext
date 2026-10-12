import { useEffect, useRef, useState } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
import { CURRENT_VERSION } from '@/const/version'
import { getDesktopApi } from '@/types/desktop'
import type { DesktopUpdatePreferences, DesktopUpdateState, DesktopUpdateStatus } from '@/types/desktopUpdater'

import { acceptUpdateSnapshot, canShowInstallConfirmation } from './updatePresentation'

export function useAboutUpdate() {
  const { message } = useApp()
  const api = getDesktopApi()
  const isDesktop = Boolean(api)
  const [desktopState, setDesktopState] = useState<DesktopUpdateState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [installConfirmationOpen, setInstallConfirmationOpen] = useState(false)
  const [installing, setInstalling] = useState(false)
  const busyRef = useRef(false)
  const aliveRef = useRef(true)

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
    if (!api || !desktopState || !canShowInstallConfirmation(desktopState.status)) return
    setInstallConfirmationOpen(true)
  }

  const closeInstallConfirmation = () => {
    if (installing) return
    setInstallConfirmationOpen(false)
  }

  const installUpdate = async () => {
    if (!api || desktopState?.status !== 'ready' || installing) return
    setInstalling(true)
    try {
      await api.updater.install()
      setInstallConfirmationOpen(false)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '安装失败，请重试。')
    } finally {
      setInstalling(false)
    }
  }

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
    installConfirmationOpen,
    installing,
    loadError,
    feedback: desktopState?.message || loadError,
    autoUpdate: desktopState?.preferences.autoUpdate ?? true,
    check,
    clearCache,
    confirmInstall,
    closeInstallConfirmation,
    installUpdate,
    setAutoUpdate,
    savePreferences,
  }
}
