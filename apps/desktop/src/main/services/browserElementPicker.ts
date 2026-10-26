export const BROWSER_PICKER_WORLD = 1001
export const CANCEL_BROWSER_PICKER = 'window.__pureBrowserPickerCancel?.()'

// Runs only in the guest's isolated world; no application bridge is installed there.
function pickBrowserElement() {
  const scope = window as Window & { __pureBrowserPickerCancel?: () => void }
  scope.__pureBrowserPickerCancel?.()
  return new Promise((resolve) => {
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647'
    const root = host.attachShadow({ mode: 'closed' })
    const box = document.createElement('div')
    box.style.cssText =
      'position:fixed;display:none;border:2px solid #1677ff;background:#1677ff22;box-sizing:border-box'
    const hint = document.createElement('div')
    hint.textContent = '点击元素添加到输入框 · Esc 取消'
    hint.style.cssText =
      'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);padding:6px 12px;border-radius:8px;background:#222;color:white;font:12px system-ui'
    root.append(box, hint)
    document.documentElement.append(host)

    const selectorOf = (element: Element) => {
      const parts: string[] = []
      let node: Element | null = element
      while (node && parts.length < 4) {
        if (node.id) {
          parts.unshift(`#${CSS.escape(node.id)}`)
          break
        }
        let part = node.tagName.toLowerCase()
        const parent: Element | null = node.parentElement
        if (parent) {
          const siblings = Array.from(parent.children).filter((child) => child.tagName === node!.tagName)
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`
        }
        parts.unshift(part)
        node = parent
      }
      return parts.join(' > ')
    }
    const swallow = (event: Event) => {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    let selected: Element | null = null
    const highlight = () => {
      if (!selected?.isConnected) {
        box.style.display = 'none'
        return
      }
      const rect = selected.getBoundingClientRect()
      Object.assign(box.style, {
        display: 'block',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      })
    }
    const move = (event: Event) => {
      selected = event.target instanceof Element ? event.target : null
      if (selected === host) selected = null
      highlight()
    }
    const listeners: Array<[string, EventListener]> = []
    let finished = false
    const finish = (payload: unknown) => {
      if (finished) return
      finished = true
      for (const [name, listener] of listeners) document.removeEventListener(name, listener, true)
      window.removeEventListener('resize', highlight)
      host.remove()
      delete scope.__pureBrowserPickerCancel
      resolve(payload)
    }
    const click = (event: Event) => {
      swallow(event)
      const element = event.target
      if (!(element instanceof Element) || element === host) return
      const clone = element.cloneNode(true) as Element
      const unsafe = 'script,style,noscript,input,textarea,select'
      clone.querySelectorAll(unsafe).forEach((child) => child.remove())
      for (const node of [clone, ...Array.from(clone.querySelectorAll('*'))]) {
        for (const attribute of Array.from(node.attributes)) {
          if (attribute.name === 'value' || attribute.name.startsWith('on')) node.removeAttribute(attribute.name)
        }
      }
      const formControl = element.matches('input,textarea,select')
      finish({
        tag: element.tagName.toLowerCase(),
        selector: selectorOf(element),
        text: formControl ? '' : (clone.textContent || '').trim().slice(0, 6000),
        html: formControl ? `<${element.tagName.toLowerCase()}>` : clone.outerHTML.slice(0, 2000),
      })
    }
    const key = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key === 'Escape') {
        swallow(event)
        finish(null)
      }
    }
    listeners.push(
      ['mousemove', move],
      ['scroll', highlight],
      ['click', click],
      ['keydown', key],
      ['pointerdown', swallow],
      ['pointerup', swallow],
      ['mousedown', swallow],
      ['mouseup', swallow]
    )
    for (const [name, listener] of listeners) document.addEventListener(name, listener, true)
    window.addEventListener('resize', highlight)
    scope.__pureBrowserPickerCancel = () => finish(null)
  })
}

export const BROWSER_PICKER_SCRIPT = `(${pickBrowserElement.toString()})()`
