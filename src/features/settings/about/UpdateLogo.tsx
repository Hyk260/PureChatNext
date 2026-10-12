import { Flex, PureChatMark } from '@pure/ui'

export function UpdateLogo({
  checking,
  downloading,
  progress,
}: {
  checking: boolean
  downloading: boolean
  progress: number
}) {
  const visible = checking || downloading
  const label = checking ? '正在检查更新' : `下载进度 ${Math.floor(progress)}%`
  return (
    <Flex className='relative flex-center size-20 shrink-0 rounded-full bg-secondary'>
      <PureChatMark size={44} />
      {visible ? (
        <div
          className='absolute inset-0'
          role='progressbar'
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={checking ? undefined : Math.floor(progress)}
        >
          <svg
            aria-hidden='true'
            className={checking ? 'size-full animate-spin motion-reduce:animate-none' : 'size-full -rotate-90'}
            viewBox='0 0 80 80'
          >
            <circle cx='40' cy='40' r='37' fill='none' stroke='currentColor' strokeWidth='3' className='text-border' />
            <circle
              cx='40'
              cy='40'
              r='37'
              fill='none'
              stroke='currentColor'
              strokeWidth='3'
              pathLength={100}
              strokeDasharray={checking ? '25 75' : `${progress} 100`}
              strokeLinecap='round'
              className='text-green'
            />
          </svg>
        </div>
      ) : null}
    </Flex>
  )
}
