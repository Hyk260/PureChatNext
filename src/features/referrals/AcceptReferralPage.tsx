import { Button } from '@pure/ui'
import { Spin } from 'antd'
import { CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import type { PublicReferral, ReferralItem } from '@pure/types'
import { sendVerificationEmail, useAuthConfig, useSession } from '@/libs/better-auth/client'
import { referralCallback } from '@/libs/referrals/helpers'

import { ReferralApiError, referralRequest } from './api'
import { ReferralHero } from './ReferralHero'

export default function AcceptReferralPage() {
  const [params] = useSearchParams()
  const context = params.get('referral_context') || ''
  const complete = params.get('complete') === '1'
  return <AcceptReferralContent key={`${context}:${complete}`} context={context} complete={complete} />
}

function AcceptReferralContent({ context, complete }: { context: string; complete: boolean }) {
  const navigate = useNavigate()
  const { data: session, isPending } = useSession()
  const { config, ready } = useAuthConfig()
  const [info, setInfo] = useState<PublicReferral>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const callbackUrl = `${referralCallback(context)}&complete=1`

  useEffect(() => {
    let cancelled = false
    referralRequest<PublicReferral>('/resolve', { context })
      .then((result) => {
        if (!cancelled) setInfo(result)
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : '邀请链接无效')
      })
    return () => {
      cancelled = true
    }
  }, [context])

  const accept = async () => {
    setBusy(true)
    setError('')
    try {
      await referralRequest<ReferralItem>('/accept', { context })
      setAccepted(true)
      setNeedsVerification(false)
    } catch (requestError) {
      setNeedsVerification(requestError instanceof ReferralApiError && requestError.code === 'verification_required')
      setError(requestError instanceof Error ? requestError.message : '接受邀请失败')
    } finally {
      setBusy(false)
    }
  }

  const userId = session?.user.id
  const invitationStatus = info?.status
  useEffect(() => {
    if (!complete || !userId || !invitationStatus || isPending) return
    let cancelled = false
    referralRequest<ReferralItem>('/accept', { context })
      .then(() => {
        if (!cancelled) {
          setAccepted(true)
          setError('')
          setNeedsVerification(false)
        }
      })
      .catch((requestError: unknown) => {
        if (cancelled) return
        setNeedsVerification(requestError instanceof ReferralApiError && requestError.code === 'verification_required')
        setError(requestError instanceof Error ? requestError.message : '接受邀请失败')
      })
    return () => {
      cancelled = true
    }
  }, [complete, context, invitationStatus, isPending, userId])

  const signup = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await referralRequest<{ email: string }>('/prepare', { context })
      navigate(`/signup?${new URLSearchParams({ email: result.email, callbackUrl })}`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '邀请不可用')
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    if (!session?.user.email) return
    setBusy(true)
    setError('')
    try {
      if (config.emailVerificationMode === 'link') {
        const result = await sendVerificationEmail({ email: session.user.email, callbackURL: callbackUrl })
        if (result.error) throw new Error(result.error.message || '验证邮件发送失败')
      }
      navigate(`/verify-email?${new URLSearchParams({ email: session.user.email, callbackUrl })}`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '验证邮件发送失败')
    } finally {
      setBusy(false)
    }
  }

  const usable = info?.status === 'sent'
  const expired = info?.status === 'expired'
  const loading = isPending || (!info && !error)
  const retry = session?.user ? accept : signup
  const actionLabel = complete && session?.user ? '重试接受邀请' : '接受邀请'

  return (
    <main className='flex min-h-dvh items-center justify-center bg-background p-4 text-foreground'>
      <article className='w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-background shadow-xl'>
        <ReferralHero />
        <section className='flex flex-col items-center gap-5 p-8 text-center'>
          {accepted ? (
            <>
              <CheckCircle2 size={56} className='text-green-500' aria-hidden />
              <h1 className='m-0 text-2xl font-semibold'>欢迎使用 PureChat</h1>
              <p className='text-muted-foreground'>邀请已接受，开始与 AI 对话、搜索和创作吧。</p>
              <Button type='primary' size='large' shape='round' onClick={() => navigate('/')}>
                开始使用
              </Button>
            </>
          ) : (
            <>
              <h1 className='m-0 text-2xl font-semibold'>你已受邀使用 PureChat</h1>
              {loading ? <Spin /> : null}
              {info ? (
                <p className='m-0 text-muted-foreground'>{info.inviterName} 邀请你一起体验 AI 对话、搜索和创作。</p>
              ) : null}
              {info ? (
                <p className='m-0 text-sm text-muted-foreground'>请使用 {info.maskedEmail} 对应邮箱注册并验证。</p>
              ) : null}
              {expired ? <p>邀请已过期，请联系好友重新发送。</p> : null}
              {info?.status === 'accepted' ? <p>此邀请已接受。</p> : null}
              {error ? (
                <p role='alert' className='m-0 text-sm text-red-500'>
                  {error}
                </p>
              ) : null}
              {needsVerification ? (
                <Button type='primary' loading={busy} disabled={!ready} onClick={verify}>
                  验证邮箱并接受邀请
                </Button>
              ) : null}
              {usable && !needsVerification ? (
                <Button type='primary' size='large' shape='round' loading={busy} disabled={isPending} onClick={retry}>
                  {actionLabel}
                </Button>
              ) : null}
              {!loading && !usable ? (
                <Button loading={busy} onClick={() => window.location.reload()}>
                  重新检查邀请
                </Button>
              ) : null}
              <Button type='link' onClick={() => navigate('/signup')}>
                普通注册
              </Button>
              {session?.user ? (
                <Button type='link' onClick={() => navigate(`/signin?${new URLSearchParams({ callbackUrl })}`)}>
                  使用其他账号登录
                </Button>
              ) : null}
            </>
          )}
        </section>
      </article>
    </main>
  )
}
