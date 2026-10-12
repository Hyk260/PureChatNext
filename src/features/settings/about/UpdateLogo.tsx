import { Flex, PureChatMark } from '@pure/ui'
import { Progress, Spin } from 'antd'

import type { DesktopUpdateStatus } from '@/types/desktopUpdater'
import { getUpdateProgressPresentation } from './updatePresentation'

export function UpdateLogo({ status, progress }: { status: DesktopUpdateStatus; progress: number }) {
  const { visible, completed, percent } = getUpdateProgressPresentation(status, progress)
  return (
    <Flex className='relative flex-center size-20 shrink-0 rounded-full bg-secondary'>
      <PureChatMark size={44} />
      {status === 'checking' ? (
        <div
          className='absolute -bottom-1 -right-1 flex-center rounded-full bg-secondary p-1'
          role='status'
          aria-label='正在检查更新'
        >
          <Spin size='small' />
        </div>
      ) : null}
      {visible ? (
        <Progress
          className='absolute inset-0'
          classNames={{ track: completed ? 'transition-none!' : 'motion-reduce:transition-none!' }}
          aria-label={`下载进度 ${Math.floor(percent)}%`}
          type='circle'
          percent={percent}
          size={80}
          strokeWidth={4}
          strokeColor='var(--color-green)'
          railColor='var(--color-border)'
          showInfo={false}
        />
      ) : null}
    </Flex>
  )
}
