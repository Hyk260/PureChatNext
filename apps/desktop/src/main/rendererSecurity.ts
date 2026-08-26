export const APP_RENDERER_URL = 'purechat://renderer/'

const parseUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.username || url.password ? null : url
  } catch {
    return null
  }
}

export const isAppRendererUrl = (value: string): boolean => {
  const url = parseUrl(value)
  return Boolean(url && url.protocol === 'purechat:' && url.hostname === 'renderer' && !url.port)
}

export const isTrustedRendererUrl = (value: string, rendererUrl: string): boolean => {
  if (isAppRendererUrl(rendererUrl)) return isAppRendererUrl(value)

  const expected = parseUrl(rendererUrl)
  const actual = parseUrl(value)
  return Boolean(
    expected && actual &&
    expected.protocol === 'http:' && expected.hostname === '127.0.0.1' &&
    actual.origin === expected.origin
  )
}

interface RendererFrame {
  url: string
}

interface RendererContents {
  isDestroyed: () => boolean
  mainFrame: RendererFrame
}

interface IpcSender {
  sender: RendererContents
  senderFrame: RendererFrame | null
}

export const assertTrustedIpcSender = (
  event: IpcSender,
  trustedContents: RendererContents | null,
  rendererUrl: string
) => {
  if (
    !trustedContents || trustedContents.isDestroyed() ||
    event.sender !== trustedContents || !event.senderFrame ||
    event.senderFrame !== trustedContents.mainFrame ||
    !isTrustedRendererUrl(event.senderFrame.url, rendererUrl)
  ) {
    throw new Error('未授权的桌面 IPC 调用')
  }
}

export const isSafeExternalUrl = (value: string): boolean => {
  const url = parseUrl(value)
  return Boolean(
    url && (url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
  )
}
