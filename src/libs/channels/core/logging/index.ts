const MESSAGE_KIND_PLACEHOLDER: Record<string, string> = {
  audio: '，内容=[语音]',
  file: '，内容=[文件]',
  image: '，内容=[图片]',
  video: '，内容=[视频]',
}

export function formatInboundVisibleContent(event: { content: string; messageKind: string }): string {
  if (event.messageKind === 'text' || event.messageKind === 'command') {
    return `，内容=${JSON.stringify(event.content.replace(/[\r\n\t]+/g, ' ').slice(0, 200))}`
  }
  return MESSAGE_KIND_PLACEHOLDER[event.messageKind] ?? ''
}
