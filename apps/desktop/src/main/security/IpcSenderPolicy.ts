import type { WebContents } from 'electron'

import { isTrustedRendererUrl } from './RendererSecurity'

export const assertTrustedIpcSender = (
  event: { sender: WebContents; senderFrame: { url: string } | null },
  trustedContents: WebContents | null,
  rendererUrl: string
) => {
  if (
    !trustedContents ||
    trustedContents.isDestroyed() ||
    event.sender !== trustedContents ||
    !event.senderFrame ||
    event.senderFrame !== trustedContents.mainFrame ||
    !isTrustedRendererUrl(event.senderFrame.url, rendererUrl)
  ) {
    throw new Error('未授权的桌面 IPC 调用')
  }
}
