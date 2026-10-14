import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

import { useApp } from '@/components/AntdStaticMethods'
import { CURRENT_VERSION } from '@/const/version'
import { getDesktopApi } from '@/types/desktop'
import type { DesktopApi } from '@/types/desktop'
import type { DesktopUpdatePreferences, DesktopUpdateState, DesktopUpdateStatus } from '@/types/desktopUpdater'

import { acceptUpdateSnapshot, canShowInstallConfirmation, getUpdateCheckFeedback } from './updatePresentation'

const CHECK_MESSAGE_KEY = 'desktop-update-check'
// Keep the last confirmed snapshot across page remounts while refreshing from Electron.
const updateSnapshots = new WeakMap<DesktopApi, DesktopUpdateState>()

export function useAboutUpdate() {
  const { message } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const api = getDesktopApi()
  const isDesktop = Boolean(api)
  const [desktopState, setDesktopState] = useState<DesktopUpdateState | null>(() =>
    api ? updateSnapshots.get(api) ?? null : null
  )
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)
  const [installConfirmationOpen, setInstallConfirmationOpen] = useState(false)
  const [installing, setInstalling] = useState(false)
  const busyRef = useRef(false)
  const aliveRef = useRef(true)
  const checkMessageRef = useRef(false)

  const receive = useCallback(
    (next: DesktopUpdateState) => {
      if (!api || !aliveRef.current) return
      const snapshot = acceptUpdateSnapshot(updateSnapshots.get(api) ?? null, next)
      updateSnapshots.set(api, snapshot)
      setDesktopState(snapshot)
    },
    [api]
  )

  useEffect(() => {
    aliveRef.current = true
    if (!api)
      return () => {
        aliveRef.current = false
      }
    const unsubscribe = api.updater.onStateChange(receive)
    api.updater
      .getState()
      .then(receive)
      .catch(() => {
        if (aliveRef.current) setLoadError('无法读取客户端更新状态，请重新打开页面后重试。')
      })
    return () => {
      aliveRef.current = false
      unsubscribe()
      if (checkMessageRef.current) {
        checkMessageRef.current = false
        message.destroy(CHECK_MESSAGE_KEY)
      }
    }
  }, [api, receive, message])

  useEffect(() => {
    if (!checkMessageRef.current || !desktopState) return
    const feedback = getUpdateCheckFeedback(desktopState)
    if (!feedback) return
    checkMessageRef.current = false
    message.open({ key: CHECK_MESSAGE_KEY, ...feedback, duration: 3 })
  }, [desktopState, message])

  const requestedInstallConfirmation =
    isDesktop && canShowInstallConfirmation(desktopState?.status || 'idle') && searchParams.get('update') === 'install'

  const clearInstallRequest = () => {
    if (searchParams.get('update') !== 'install') return
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('update')
    setSearchParams(nextParams, { replace: true })
  }

  const confirmInstall = () => {
    if (!api || !desktopState || !canShowInstallConfirmation(desktopState.status)) return
    setInstallConfirmationOpen(true)
  }

  const closeInstallConfirmation = () => {
    if (installing) return
    setInstallConfirmationOpen(false)
    clearInstallRequest()
  }

  const installUpdate = async () => {
    if (!api || desktopState?.status !== 'ready' || !desktopState.installationSupport?.supported || installing) return
    setInstalling(true)
    try {
      await api.updater.install()
      setInstallConfirmationOpen(false)
      clearInstallRequest()
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
    checkMessageRef.current = true
    message.open({ key: CHECK_MESSAGE_KEY, type: 'loading', content: '正在检查更新…', duration: 0 })
    try {
      receive(await api.updater.check())
    } catch (error) {
      checkMessageRef.current = false
      if (aliveRef.current) {
        message.open({
          key: CHECK_MESSAGE_KEY,
          type: 'error',
          content: error instanceof Error ? error.message : '检查更新失败，请重试。',
          duration: 3,
        })
      }
    } finally {
      busyRef.current = false
      if (aliveRef.current) setPending(false)
    }
  }

  const savePreferences = async (patch: Partial<DesktopUpdatePreferences>) => {
    if (!api || !desktopState || busyRef.current) return false
    busyRef.current = true
    setPending(true)
    if (patch.updateSource !== undefined) {
      setInstallConfirmationOpen(false)
      clearInstallRequest()
      if (checkMessageRef.current) {
        checkMessageRef.current = false
        message.destroy(CHECK_MESSAGE_KEY)
      }
    }
    try {
      receive(await api.updater.setPreferences({ ...desktopState.preferences, ...patch }))
      if (patch.updateSource !== undefined) {
        message.success('更新来源已保存')
      }
      return true
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存更新设置失败。')
      return false
    } finally {
      busyRef.current = false
      if (aliveRef.current) setPending(false)
    }
  }

  const clearCache = async () => {
    if (!api || !desktopState?.developmentCachePath || busyRef.current) return
    busyRef.current = true
    setPending(true)
    setClearingCache(true)
    try {
      receive(await api.updater.clearCache())
      message.success('下载安装包缓存已清理')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '清理更新缓存失败，请重试。')
    } finally {
      busyRef.current = false
      if (aliveRef.current) {
        setPending(false)
        setClearingCache(false)
      }
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
    clearingCache,
    installConfirmationOpen: installConfirmationOpen || requestedInstallConfirmation,
    installing,
    loadError,
    feedback: desktopState?.message || loadError,
    autoUpdate: desktopState?.preferences.autoUpdate ?? false,
    check,
    clearCache,
    confirmInstall,
    closeInstallConfirmation,
    installUpdate,
    setAutoUpdate,
    savePreferences,
  }
}
