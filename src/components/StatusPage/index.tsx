import type { ReactNode, ComponentProps } from 'react'
import { Button, Result } from '@lobehub/ui'
import { ArrowLeft } from 'lucide-react'

import { usePathname, useRouter } from 'next/navigation'
import { getDesktopApi } from '@/types/desktop'

export const StatusHomeButton = () => {
  const router = useRouter()

  return (
    <Button
      type='primary'
      onClick={() => router.push('/')}
    >
      返回首页
    </Button>
  )
}

type StatusPageProps = Omit<ComponentProps<typeof Result>, 'status'> & {
  status?: ComponentProps<typeof Result>['status'] | '403' | '404'
}

const StatusPageFrame = ({
  code,
  description,
  extra,
  title,
}: {
  code: string
  description: ReactNode
  extra?: ReactNode
  title: ReactNode
}) => (
  <main
    className={
      getDesktopApi()
        ? 'min-h-full grid place-items-center overflow-y-auto bg-background px-6 py-16 text-center'
        : 'min-h-svh grid place-items-center overflow-y-auto bg-background px-6 py-16 text-center'
    }
  >
    <div className='flex w-full max-w-3xl flex-col items-center gap-5'>
      <div
        aria-hidden='true'
        className='bg-linear-to-r from-violet-500 via-pink-500 to-orange-400 bg-clip-text text-8xl font-bold text-transparent md:text-9xl'
      >
        {code}
      </div>
      <h1 className='text-2xl font-semibold tracking-tight text-foreground md:text-[30px]'>{title}</h1>
      <div className='flex flex-col items-center gap-3 text-sm leading-6 text-muted-foreground md:text-base'>
        {description}
      </div>
      {extra && <div className='mt-3 flex flex-wrap items-center justify-center gap-3'>{extra}</div>}
    </div>
  </main>
)

export const StatusPage = ({ status, ...props }: StatusPageProps) => {
  const pathname = usePathname()
  const router = useRouter()

  if (status === '404') {
    return (
      <StatusPageFrame
        code='404'
        description={
          <>
            <p>
              你访问的页面 <code className='rounded border border-border px-2 py-0.5 font-mono'>{pathname}</code>{' '}
              不存在，可能已移动或删除。
            </p>
            <p>请检查链接地址，或返回首页继续使用。</p>
          </>
        }
        extra={
          <>
            <StatusHomeButton />
            <Button
              className='h-12 px-5'
              icon={<ArrowLeft size={16} />}
              onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
            >
              返回上一页
            </Button>
          </>
        }
        title='页面暂时找不到'
      />
    )
  }

  if (status === 'error') {
    return (
      <StatusPageFrame
        code='!'
        description={props.subTitle ?? '页面遇到了问题，请稍后重试'}
        extra={props.extra}
        title={props.title ?? '页面遇到了问题'}
      />
    )
  }

  return (
    <main
      className={
        getDesktopApi()
          ? 'min-h-full shrink-0 flex w-full items-center justify-center bg-background'
          : 'min-h-svh flex w-full items-center justify-center bg-background'
      }
    >
      <Result {...props} status={status === '403' ? 'error' : status} />
    </main>
  )
}

export const StatusActions = ({ children }: { children: ReactNode }) => (
  <div className='flex flex-wrap justify-center gap-3'>{children}</div>
)
