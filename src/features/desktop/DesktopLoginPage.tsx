'use client'

import { Button, Flex, Input, Text } from '@pure/ui'
import { AlertCircle, CheckCircle2, Cloud, Server, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import InsetContentFrame from '@/layout/InsetContentFrame'
import { useDesktopSession } from '@/libs/better-auth/client/desktop-session'
import type { DesktopAuthStatus } from '@/types/desktop'
import { getDesktopApi } from '@/types/desktop'

type DesktopLoginPageProps = {
  onSuccess?: () => void
  standalone?: boolean
}

const formatRemaining = (expiresAt: number, now: number) => {
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const DesktopLoginPage = ({ onSuccess, standalone = false }: DesktopLoginPageProps) => {
  const api = getDesktopApi()
  const { data: desktopSession, error: desktopSessionError, isPending: desktopSessionPending } = useDesktopSession()
  const [serverUrl, setServerUrl] = useState('')
  const [cloudUrl, setCloudUrl] = useState('')
  const [status, setStatus] = useState<DesktopAuthStatus>({ status: 'signedOut' })
  const [loading, setLoading] = useState(Boolean(api))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const handledSuccess = useRef(false)

  useEffect(() => {
    if (!api) {
      return
    }

    let active = true
    const unsubscribe = api.auth.onStatusChange((nextStatus) => {
      if (active) setStatus(nextStatus)
    })
    Promise.all([api.getRemoteServer(), api.getCloudServer(), api.auth.getStatus()])
      .then(([remote, cloud, authStatus]) => {
        if (!active) return
        setServerUrl(remote.url ?? '')
        setCloudUrl(cloud.url ?? '')
        setStatus(authStatus)
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : '加载桌面授权配置失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      unsubscribe()
    }
  }, [api])

  useEffect(() => {
    if (status.status !== 'waiting') return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    const expiryTimer = window.setTimeout(
      () => {
        if (!api) return
        api.auth.cancel().then(() => {
          setStatus({ message: '授权已过期，请重新开始登录', status: 'error' })
        })
      },
      Math.max(0, status.expiresAt - Date.now())
    )
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(expiryTimer)
    }
  }, [api, status])

  useEffect(() => {
    if (status.status !== 'signedIn' || !desktopSession?.user || handledSuccess.current) return
    handledSuccess.current = true
    if (standalone) window.location.reload()
    else onSuccess?.()
  }, [desktopSession?.user, onSuccess, standalone, status.status])

  const waiting = status.status === 'waiting'
  const sessionError =
    status.status === 'signedIn' && !desktopSessionPending && desktopSessionError
      ? '已收到授权结果，但桌面会话验证失败。请检查服务地址或网络后重试。'
      : ''
  const statusMessage = status.status === 'error' ? status.message : error || sessionError
  const remaining = status.status === 'waiting' ? formatRemaining(status.expiresAt, now || status.expiresAt) : null
  const canStart = Boolean(api && !loading && !submitting && !waiting)

  const startAuthorization = async (targetUrl: string) => {
    if (!api || !targetUrl) return
    setSubmitting(true)
    setError('')
    try {
      setStatus(await api.auth.start({ serverUrl: targetUrl }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法打开 Web 授权页面')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSelfHostedSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await startAuthorization(serverUrl.trim())
  }

  const handleCancel = async () => {
    if (!api) return
    setError('')
    setStatus(await api.auth.cancel())
  }

  const handleCloudClick = async () => {
    await startAuthorization(cloudUrl)
  }

  const handleRetry = () => {
    setError('')
    setStatus({ status: 'signedOut' })
  }

  const verifying = status.status === 'signedIn' && !desktopSession?.user
  const title = waiting ? '正在等待浏览器授权' : verifying ? '正在验证桌面登录' : '登录以同步你的 PureChat'
  const description = waiting
    ? '请在刚刚打开的浏览器页面中完成登录，授权结果会自动返回桌面应用。'
    : verifying
      ? '授权结果已返回，正在确认服务连接和登录状态。'
      : '登录后即可在桌面端继续使用你的聊天、设置和服务实例。'

  return (
    <InsetContentFrame sidebarCollapsed>
      <Flex className='w-full overflow-y-auto px-6 py-10 sm:px-10'>
        <Flex className='m-auto w-full max-w-[560px] flex-col gap-8 py-6 sm:py-12'>
          <Flex className='flex-col items-start gap-5'>
            <Flex className='size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground'>
              <Cloud aria-hidden size={26} strokeWidth={1.8} />
            </Flex>
            <Text as='h1' className='!m-0 !text-2xl tracking-tight sm:!text-3xl' weight={600}>
              {title}
            </Text>
            <Text as='p' className='!m-0' fontSize={15} lineHeight={1.75} type='secondary'>
              {description}
            </Text>
          </Flex>

          <Flex className='flex-col gap-3'>
            <Button
              block
              disabled={!canStart || !cloudUrl}
              icon={Cloud}
              loading={submitting || waiting || verifying}
              size='large'
              type='primary'
              onClick={handleCloudClick}
            >
              登录 PureChat Cloud
            </Button>
            {waiting ? (
              <Flex aria-live='polite' className='flex-col gap-2' role='status'>
                <Text type='secondary'>等待授权…</Text>
                <Flex className='items-center justify-between gap-3'>
                  <Text className='font-mono' type='secondary'>
                    {remaining}
                  </Text>
                  <Button icon={X} size='small' type='text' onClick={handleCancel}>
                    取消授权
                  </Button>
                </Flex>
              </Flex>
            ) : null}
          </Flex>

          {statusMessage ? (
            <Flex className='items-start gap-3 rounded-xl border border-red/25 bg-red-tint p-4' role='alert'>
              <AlertCircle aria-hidden className='mt-0.5 shrink-0 text-red' size={18} />
              <Text className='flex-1' type='danger'>
                {statusMessage}
              </Text>
              {status.status === 'error' ? (
                <Button aria-label='关闭错误提示' icon={X} size='small' type='text' onClick={handleRetry} />
              ) : null}
            </Flex>
          ) : null}

          <Flex className='items-center gap-4 py-2'>
            <Flex aria-hidden className='h-px flex-1 bg-app-border-secondary' />
            <Text fontSize={12} type='secondary'>
              或连接自建服务
            </Text>
            <Flex aria-hidden className='h-px flex-1 bg-app-border-secondary' />
          </Flex>

          <form className='flex flex-col gap-4' onSubmit={handleSelfHostedSubmit}>
            <label className='text-sm text-muted-foreground' htmlFor='desktop-server-url'>
              PureChat 服务地址
            </label>
            <Input
              autoComplete='url'
              disabled={submitting || waiting}
              id='desktop-server-url'
              placeholder='https://your-server.example.com'
              prefix={<Server aria-hidden size={18} />}
              size='large'
              type='url'
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
            />
            <Button block disabled={!canStart || !serverUrl.trim()} htmlType='submit' icon={Server} size='large'>
              连接服务器并授权
            </Button>
          </form>

          {status.status === 'signedIn' && desktopSession?.user ? (
            <Flex aria-live='polite' className='items-center gap-2' role='status'>
              <CheckCircle2 aria-hidden className='text-green' size={17} />
              <Text type='success'>授权成功，正在返回应用…</Text>
            </Flex>
          ) : (
            <Text as='p' className='!m-0' fontSize={12} lineHeight={1.75} type='secondary'>
              登录页面会在系统默认浏览器中打开，PureChat 不会读取浏览器中的账号密码。
            </Text>
          )}
        </Flex>
      </Flex>
    </InsetContentFrame>
  )
}

export default DesktopLoginPage
