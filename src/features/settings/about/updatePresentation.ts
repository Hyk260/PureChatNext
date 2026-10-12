import type { DesktopUpdateState, DesktopUpdateStatus } from '@/types/desktopUpdater'

export function acceptUpdateSnapshot(previous: DesktopUpdateState | null, next: DesktopUpdateState) {
  return previous && previous.revision > next.revision ? previous : next
}

const BUTTON_LABELS: Record<DesktopUpdateStatus, string> = {
  idle: '检查更新',
  checking: '正在检查',
  upToDate: '检查更新',
  downloading: '正在下载',
  downloaded: '重启并安装',
  ready: '重启并安装',
  installing: '正在安装',
  error: '重试',
  unsupported: '手动下载',
}

export function getUpdateButtonLabel(status: DesktopUpdateStatus, progress = 0) {
  if (status === 'downloading') return `正在下载 ${Math.floor(progress)}%`
  return BUTTON_LABELS[status]
}

export function canShowInstallConfirmation(status: DesktopUpdateStatus) {
  return status === 'ready' || status === 'downloaded'
}

export function getUpdateProgressPresentation(status: DesktopUpdateStatus, progress = 0) {
  const completed = canShowInstallConfirmation(status) || status === 'installing'
  let percent = 0
  if (completed) percent = 100
  else if (status === 'downloading' && Number.isFinite(progress)) percent = Math.max(0, Math.min(100, progress))
  return { visible: status === 'downloading' || completed, completed, percent }
}
