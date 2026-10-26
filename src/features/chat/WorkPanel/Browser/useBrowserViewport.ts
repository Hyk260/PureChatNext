import { useEffect, useRef } from 'react'

import { getDesktopApi } from '@/types/desktop'

const OCCLUDING_OVERLAYS = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'

type Edges = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>

export function browserViewportBounds(viewport: Edges, clip: Edges) {
  const x = Math.max(viewport.left, clip.left)
  const y = Math.max(viewport.top, clip.top)
  return {
    x,
    y,
    width: Math.max(0, Math.min(viewport.right, clip.right) - x),
    height: Math.max(0, Math.min(viewport.bottom, clip.bottom) - y),
  }
}

export function hasBrowserOverlay() {
  return Array.from(document.querySelectorAll<HTMLElement>(OCCLUDING_OVERLAYS)).some((element) => {
    if (element.getAttribute('aria-hidden') === 'true') return false
    const style = getComputedStyle(element)
    return element.getClientRects().length > 0 && style.visibility !== 'hidden' && style.display !== 'none'
  })
}

export function useBrowserViewport(sessionId: string | undefined, visible: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const host = ref.current
    const api = getDesktopApi()?.browser
    if (!host || !api || !sessionId) return
    let frame = 0
    let last = ''
    let disposed = false
    let occluded = false
    let revision = 0
    let preview: 'none' | 'pending' | 'ready' | 'failed' = 'none'
    const clearPreview = () => {
      host.style.removeProperty('background-image')
      host.style.removeProperty('background-size')
    }
    const shell = host.closest('[data-work-panel-shell]')
    const sync = () => {
      frame = 0
      if (disposed) return
      const bounds = host.getBoundingClientRect()
      const shellBounds = shell?.getBoundingClientRect()
      const clip = {
        left: Math.max(0, shellBounds?.left ?? 0),
        top: Math.max(0, shellBounds?.top ?? 0),
        right: Math.min(window.innerWidth, shellBounds?.right ?? window.innerWidth),
        bottom: Math.min(window.innerHeight, shellBounds?.bottom ?? window.innerHeight),
      }
      const collapsed = host.closest('[data-collapsed="true"], [hidden]') !== null
      const active = visible && !collapsed && !document.hidden
      const covered = active && hasBrowserOverlay()
      if (covered !== occluded) {
        occluded = covered
        revision += 1
        preview = 'none'
      }
      if (covered && preview === 'none') {
        preview = 'pending'
        const request = revision
        // Native views paint above DOM popovers. Preserve their pixels before hiding them.
        api
          .capture({ sessionId })
          .then(async ({ dataUrl }) => {
            const image = new Image()
            image.src = dataUrl
            await image.decode()
            if (disposed || request !== revision) return
            host.style.backgroundImage = `url("${dataUrl}")`
            host.style.backgroundSize = '100% 100%'
            preview = 'ready'
            schedule()
          })
          .catch(() => {
            if (disposed || request !== revision) return
            preview = 'failed'
            schedule()
          })
      }
      if (!active) clearPreview()
      const layout = {
        sessionId,
        ...browserViewportBounds(bounds, clip),
        visible: active && (!covered || preview === 'pending'),
      }
      const key = JSON.stringify(layout)
      if (key !== last) {
        last = key
        api
          .layout(layout)
          .then(() => {
            if (!disposed && last === key && layout.visible && !occluded) clearPreview()
          })
          .catch(() => undefined)
      } else if (layout.visible && !occluded) {
        clearPreview()
      }
    }
    const schedule = () => {
      if (!frame && !disposed) frame = requestAnimationFrame(sync)
    }
    const resize = new ResizeObserver(schedule)
    resize.observe(host)
    if (shell) resize.observe(shell)
    const mutations = new MutationObserver(schedule)
    mutations.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'inert', 'aria-hidden', 'data-open', 'data-state', 'data-collapsed', 'style'],
    })
    shell?.addEventListener('transitionend', schedule)
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    document.addEventListener('visibilitychange', schedule)
    sync()
    return () => {
      disposed = true
      clearPreview()
      cancelAnimationFrame(frame)
      resize.disconnect()
      mutations.disconnect()
      shell?.removeEventListener('transitionend', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      document.removeEventListener('visibilitychange', schedule)
      api.layout({ sessionId, visible: false, x: 0, y: 0, width: 0, height: 0 }).catch(() => undefined)
    }
  }, [sessionId, visible])
  return ref
}
