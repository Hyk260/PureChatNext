'use client'

import { getErrorMessage } from '@pure/utils/error'

import { Button, Text } from '@pure/ui'
import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { useSession } from '@/libs/better-auth/client'
import { apiFetch, jsonInit } from '@/utils/apiFetch'

type AuthorizePageState = 'error' | 'loginRequired' | 'pending' | 'success'

const PAGE_CONTENT: Record<AuthorizePageState, { description: string; title: string }> = {
  error: { description: '', title: '授权未完成' },
  loginRequired: { description: '正在跳转到登录页面…', title: '需要先登录 PureChat' },
  pending: { description: '正在确认登录授权，请稍候。', title: '正在完成授权' },
  success: { description: '你可以关闭此页面，返回桌面端。', title: '登录成功' },
}

const PAGE_ICON_CLASS: Record<AuthorizePageState, string> = {
  error: 'text-red',
  loginRequired: 'animate-spin text-primary',
  pending: 'animate-spin text-primary',
  success: 'text-green',
}

const PAGE_ICON = {
  error: AlertCircle,
  loginRequired: LoaderCircle,
  pending: LoaderCircle,
  success: CheckCircle2,
} satisfies Record<AuthorizePageState, typeof AlertCircle>

const getPageState = ({
  error,
  hasSession,
  isPending,
  hasRedirectUri,
}: {
  error: string
  hasRedirectUri: boolean
  hasSession: boolean
  isPending: boolean
}): AuthorizePageState => {
  if (error) return 'error'
  if (hasRedirectUri) return 'success'
  if (isPending || hasSession) return 'pending'
  return 'loginRequired'
}

const DesktopAuthorizePage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { data: session, isPending } = useSession()
  const started = useRef(false)
  const [error, setError] = useState('')
  const [redirectUri, setRedirectUri] = useState('')
  const search = useMemo(() => new URLSearchParams(location.search), [location.search])
  const callbackUrl = `${location.pathname}${location.search}`

  useEffect(() => {
    if (isPending || session?.user || started.current) return
    navigate(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`, { replace: true })
  }, [callbackUrl, isPending, navigate, session?.user])

  useEffect(() => {
    if (isPending || !session?.user || started.current) return
    started.current = true

    const authorize = async () => {
      const response = await apiFetch(
        '/api/auth/desktop/authorize',
        jsonInit(
          {
            client_id: search.get('client_id'),
            code_challenge: search.get('code_challenge'),
            code_challenge_method: search.get('code_challenge_method'),
            redirect_uri: search.get('redirect_uri'),
            state: search.get('state'),
          },
          { method: 'POST' }
        )
      )
      const body = (await response.json().catch(() => ({}))) as { error?: string; redirectUri?: string }
      if (!response.ok || !body.redirectUri) throw new Error(body.error || '桌面授权失败')
      setRedirectUri(body.redirectUri)
      window.location.assign(body.redirectUri)
    }

    authorize().catch((cause) => {
      setError(getErrorMessage(cause, '桌面授权失败'))
      started.current = false
    })
  }, [isPending, search, session?.user])

  const pageState = getPageState({
    error,
    hasRedirectUri: Boolean(redirectUri),
    hasSession: Boolean(session?.user),
    isPending,
  })
  const pageContent = PAGE_CONTENT[pageState]
  const PageIcon = PAGE_ICON[pageState]
  const description = pageState === 'error' ? error : pageContent.description

  const openDesktopApp = () => {
    if (!redirectUri) return
    window.location.assign(redirectUri)
  }

  const reloadPage = () => window.location.reload()

  return (
    <main className='flex-center min-h-full bg-app-layout px-6 py-10'>
      <section className='w-full max-w-[480px] rounded-3xl border border-app-border-secondary bg-app-surface p-8 text-center shadow-card'>
        <PageIcon aria-hidden className={`mx-auto ${PAGE_ICON_CLASS[pageState]}`} size={34} />
        <h1 className='mt-5 text-2xl font-semibold tracking-tight text-foreground'>{pageContent.title}</h1>
        <Text as='p' fontSize={14} type='secondary' className='mt-3! leading-6'>
          {description}
        </Text>
        {pageState === 'success' ? (
          <Button className='mt-6' type='primary' onClick={openDesktopApp}>
            打开应用
          </Button>
        ) : null}
        {pageState === 'error' ? (
          <Button className='mt-6' type='primary' onClick={reloadPage}>
            重试授权
          </Button>
        ) : null}
      </section>
    </main>
  )
}

export default DesktopAuthorizePage
