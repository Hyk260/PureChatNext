import type { DesktopUpdateState, DesktopUpdateStatus } from '@/types/desktopUpdater'

export function acceptUpdateSnapshot(previous: DesktopUpdateState | null, next: DesktopUpdateState) {
  return previous && previous.revision > next.revision ? previous : next
}

export function getUpdateCheckFeedback(state: DesktopUpdateState) {
  switch (state.status) {
    case 'upToDate':
      return { type: 'success' as const, content: state.message || '当前已是最新版本。' }
    case 'downloading':
      return {
        type: 'info' as const,
        content: state.release ? `发现新版本 v${state.release.version}，正在下载…` : '发现新版本，正在下载…',
      }
    case 'ready':
    case 'downloaded':
      return { type: 'success' as const, content: state.message || '更新已下载，请查看更新详情。' }
    case 'error':
      return { type: 'error' as const, content: state.message || '检查更新失败，请重试。' }
    case 'unsupported':
      return { type: 'warning' as const, content: state.message || '当前客户端暂不支持自动更新，请手动下载。' }
    default:
      return null
  }
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
