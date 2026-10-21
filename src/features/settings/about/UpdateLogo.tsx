import { Flex, PureChatMark } from '@pure/ui'
import { Progress, Spin, createStaticStyles } from '@lobehub/ui'

import type { DesktopUpdateStatus } from '@/types/desktopUpdater'
import { getUpdateProgressPresentation } from './updatePresentation'

const styles = createStaticStyles(({ css }) => ({
  completed: css`
    .lobe-progress__bar {
      transition: none !important;
    }
  `,
  progress: css`
    @media (prefers-reduced-motion: reduce) {
      .lobe-progress__bar {
        transition: none;
      }
    }
  `,
}))

export function UpdateLogo({
  status,
  progress,
  checking,
}: {
  status: DesktopUpdateStatus
  progress: number
  checking: boolean
}) {
  const { visible, completed, percent } = getUpdateProgressPresentation(status, progress)

  return (
    <Flex className='relative flex-center size-20 shrink-0 rounded-full bg-secondary'>
      <PureChatMark size={44} />
      <div
        className={`absolute -bottom-1 -right-1 flex-center rounded-full bg-secondary p-1 ${checking ? 'visible' : 'invisible'}`}
        role={checking ? 'status' : undefined}
        aria-label={checking ? '正在检查更新' : undefined}
        aria-hidden={!checking}
      >
        <Spin size='small' />
      </div>
      {visible ? (
        <Progress
          className={`absolute inset-0 ${styles.progress} ${completed ? styles.completed : ''}`}
          aria-label={`下载进度 ${Math.floor(percent)}%`}
          type='circle'
          percent={percent}
          size={80}
          strokeColor='var(--color-green)'
          showInfo={false}
        />
      ) : null}
    </Flex>
  )
}
