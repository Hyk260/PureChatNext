import type { ChannelEventFileModel } from '@pure/database/models/channelEventFile'

export type ChannelFileRow = Awaited<ReturnType<ChannelEventFileModel['listForEvent']>>[number]

export const mapOutboundAttachments = (rows: readonly ChannelFileRow[]) =>
  rows
    .filter(({ artifact }) => artifact.direction === 'output')
    .map(({ artifact, file }) => ({
      deliveryError: artifact.deliveryError,
      deliveryStatus: artifact.deliveryStatus,
      direction: artifact.direction,
      fileId: file.id,
      fileName: file.name,
      fileSize: file.size,
      id: artifact.id,
      summary: artifact.summary,
      version: artifact.version,
    }))

export function buildConversationFileContext(
  conversationFiles: readonly ChannelFileRow[],
  platform: 'qq' | 'wechat'
): string | undefined {
  if (!conversationFiles.length) return undefined
  return [
    `<${platform}_conversation_files>`,
    ...conversationFiles.map(({ artifact, file }) =>
      JSON.stringify({
        direction: artifact.direction,
        fileId: file.id,
        filename: file.name,
        summary: artifact.summary,
        version: artifact.version,
      })
    ),
    `</${platform}_conversation_files>`,
    '用户说“这个文件/上面的文件”时，默认使用列表中最新的 output，否则使用最新 input。多个同等候选时先询问。',
  ].join('\n')
}
