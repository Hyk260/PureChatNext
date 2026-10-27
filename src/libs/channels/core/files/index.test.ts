import { describe, expect, it } from 'vitest'

import { buildConversationFileContext, mapOutboundAttachments } from './index'
import type { ChannelFileRow } from './index'

const createRow = (direction: 'input' | 'output', id: string): ChannelFileRow =>
  ({
    artifact: {
      id: `artifact-${id}`,
      direction,
      deliveryError: null,
      deliveryStatus: 'sent',
      summary: 'summary',
      version: 2,
    },
    file: { id, name: `${id}.txt`, size: 42 },
  }) as ChannelFileRow

describe('channel file projections', () => {
  it('retains output order, delivery fields and file metadata', () => {
    expect(
      mapOutboundAttachments([createRow('input', 'in'), createRow('output', 'one'), createRow('output', 'two')])
    ).toEqual([
      {
        deliveryError: null,
        deliveryStatus: 'sent',
        direction: 'output',
        fileId: 'one',
        fileName: 'one.txt',
        fileSize: 42,
        id: 'artifact-one',
        summary: 'summary',
        version: 2,
      },
      {
        deliveryError: null,
        deliveryStatus: 'sent',
        direction: 'output',
        fileId: 'two',
        fileName: 'two.txt',
        fileSize: 42,
        id: 'artifact-two',
        summary: 'summary',
        version: 2,
      },
    ])
  })

  it.each(['qq', 'wechat'] as const)('preserves %s context tags and serialized field order', (platform) => {
    expect(buildConversationFileContext([], platform)).toBeUndefined()
    const context = buildConversationFileContext([createRow('output', 'one')], platform)!
    expect(context.split('\n')).toEqual([
      `<${platform}_conversation_files>`,
      '{"direction":"output","fileId":"one","filename":"one.txt","summary":"summary","version":2}',
      `</${platform}_conversation_files>`,
      '用户说“这个文件/上面的文件”时，默认使用列表中最新的 output，否则使用最新 input。多个同等候选时先询问。',
    ])
  })
})
