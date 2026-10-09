'use client'

import { Button, Text } from '@pure/ui'
import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { useSession } from '@/libs/better-auth/client'
import { apiFetch, jsonInit } from '@/utils/apiFetch'

const DesktopAuthorizePage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { data: session, isPending } = useSession()
  const started = useRef(false)
  const [error, setError] = useState('')
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
      window.location.assign(body.redirectUri)
    }

    authorize().catch((cause) => {
      setError(cause instanceof Error ? cause.message : '桌面授权失败')
      started.current = false
    })
  }, [isPending, search, session?.user])

  const title = error ? '授权未完成' : session?.user ? '正在返回 PureChat' : '需要先登录 PureChat'

  return (
    <main className='flex-center min-h-full bg-app-layout px-6 py-10'>
      <section className='w-full max-w-[480px] rounded-3xl border border-app-border-secondary bg-app-surface p-8 text-center shadow-card'>
        {error ? (
          <AlertCircle className='mx-auto text-red' size={34} />
        ) : session?.user ? (
          <CheckCircle2 className='mx-auto text-green' size={34} />
        ) : (
          <LoaderCircle className='mx-auto animate-spin text-primary' size={34} />
        )}
        <h1 className='mt-5 text-2xl font-semibold tracking-tight text-foreground'>{title}</h1>
        <Text as='p' fontSize={14} type='secondary' className='mt-3! leading-6'>
          {error || '完成授权后，这个页面会自动关闭或返回桌面应用。'}
        </Text>
        {error ? (
          <Button className='mt-6' type='primary' onClick={() => window.location.reload()}>
            重试授权
          </Button>
        ) : null}
      </section>
    </main>
  )
}

export default DesktopAuthorizePage
