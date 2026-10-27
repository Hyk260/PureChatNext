import { getErrorMessage } from '@pure/utils/error'
import { Text, Flex, Button, TextArea, Modal } from '@pure/ui'
import { CheckCircle2, CircleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import type { ReferralBatchResponse } from '@pure/types'
import { parseReferralEmails, REFERRAL_STATUS_LABELS } from '@/libs/referrals/helpers'

import { referralRequest } from './api'
import { ReferralHero } from './ReferralHero'
import { ReferralHistory } from './ReferralHistory'

function resultTitle(allSent: boolean, count: number) {
  if (allSent) return '邀请已发送'
  if (count) return `已发送 ${count} 个邀请`
  return '邀请未发送成功'
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function ReferralModal({ open, onClose }: Props) {
  const [view, setView] = useState<'send' | 'result' | 'history'>('send')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [now, setNow] = useState(Date.now)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ReferralBatchResponse>()
  const requestRef = useRef<{ fingerprint: string; key: string } | null>(null)
  const validation = parseReferralEmails(input)
  const sendDisabled = loading || Boolean(validation.error)
  const sentCount = result?.results.filter((item) => item.invitation?.status === 'sent').length ?? 0
  const allSent = Boolean(result?.results.length && sentCount === result.results.length)

  const send = async (emails: string[], merge = false) => {
    const fingerprint = JSON.stringify(emails)
    if (requestRef.current?.fingerprint !== fingerprint) requestRef.current = { fingerprint, key: crypto.randomUUID() }
    setLoading(true)
    setError('')
    try {
      const response = await referralRequest<ReferralBatchResponse>('', { emails, requestKey: requestRef.current!.key })
      setResult((previous) => {
        if (!merge || !previous) return response
        const replacements = new Map(response.results.map((item) => [item.email, item]))
        return { results: previous.results.map((item) => replacements.get(item.email) || item) }
      })
      requestRef.current = null
      setView('result')
    } catch (requestError) {
      setError(getErrorMessage(requestError, '邀请发送失败'))
    } finally {
      setLoading(false)
    }
  }
  const submit = () => {
    if (validation.error) {
      setError(validation.error)
      return
    }
    send(validation.emails)
  }
  const retryable =
    result?.results
      .filter((item) => {
        const invitation = item.invitation
        return invitation?.status === 'failed' && now - Date.parse(invitation.createdAt) >= 60000
      })
      .map((item) => item.email) ?? []
  const retryFailed = () => {
    const failed = retryable
    if (failed.length) send(failed, true)
  }
  const hasFailed = result?.results.some((item) => item.invitation?.status === 'failed') ?? false
  useEffect(() => {
    if (!open || view !== 'result' || !hasFailed) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [hasFailed, open, view])
  const resetAfterClose = () => {
    if (loading || requestRef.current) return
    setView('send')
    setResult(undefined)
    setError('')
    setInput('')
  }
  const close = onClose
  const returnToSend = () => {
    setView('send')
    setError('')
  }
  const showHistory = () => {
    setView('history')
  }

  return (
    <Modal
      open={open}
      onCancel={close}
      afterClose={resetAfterClose}
      footer={null}
      width={720}
      styles={{
        body: { padding: 0 },
        header: { position: 'absolute', right: 12, top: 12, padding: 0, border: 0, zIndex: 1 },
      }}
      style={{ borderRadius: 24, overflow: 'hidden' }}
      title={
        <Text as='span' color='inherit' className='sr-only'>
          邀请好友
        </Text>
      }
      draggable={false}
      centered
    >
      {view === 'history' ? <ReferralHistory onBack={returnToSend} /> : null}
      {view === 'send' ? (
        <div className='overflow-hidden rounded-2xl'>
          <ReferralHero />
          <section className='flex flex-col items-center gap-6 px-6 py-10 text-center sm:px-10'>
            <div>
              <Text as='h1' fontSize={24} weight={600} color='inherit' className='m-0!'>
                邀请朋友使用 PureChat
              </Text>
              <Text as='p' fontSize={16} type='secondary' className='mt-3!'>
                好友通过邀请注册并验证邮箱后，双方各得 0.5M 积分。
              </Text>
              <Link to='/settings/referral' onClick={onClose} className='text-sm underline'>
                查看推荐奖励与邀请码
              </Link>
            </div>
            <div className='w-full text-left'>
              <label htmlFor='referral-emails' className='sr-only'>
                好友电子邮箱
              </label>
              <TextArea
                id='referral-emails'
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder='添加电子邮箱，多个邮箱用逗号或换行分隔'
                autoSize={{ minRows: 2, maxRows: 5 }}
                disabled={loading}
              />
              <Text as='p' fontSize={12} type='secondary' className='mb-0! mt-2!'>
                每次最多 3 位好友，邀请链接有效期为 7 天。
              </Text>
              {input && validation.error ? (
                <Text as='p' fontSize={14} type='danger'>
                  {validation.error}
                </Text>
              ) : null}
            </div>
            {error ? (
              <Text as='p' fontSize={14} type='danger' role='alert'>
                {error}
              </Text>
            ) : null}
            <Flex className='gap-3'>
              <Button size='large' shape='round' onClick={showHistory}>
                跟踪邀请
              </Button>
              <Button
                size='large'
                shape='round'
                type='primary'
                loading={loading}
                disabled={sendDisabled}
                onClick={submit}
              >
                发送
              </Button>
            </Flex>
          </section>
        </div>
      ) : null}
      {view === 'result' ? (
        <section className='flex min-h-[440px] flex-col items-center gap-6 px-6 py-12 text-center sm:px-10'>
          {allSent ? (
            <CheckCircle2 size={64} className='text-green-500' aria-hidden />
          ) : (
            <CircleAlert size={64} className='text-orange-500' aria-hidden />
          )}
          <Text as='h2' fontSize={24} weight={600} color='inherit' className='m-0!'>
            {resultTitle(allSent, sentCount)}
          </Text>
          <Text as='p' type='secondary' className='m-0!'>
            {sentCount
              ? '好友将收到邀请，可加入 PureChat，体验 AI 对话、搜索和创作。'
              : '请检查下方结果。发送结果待确认的邀请请勿重复发送。'}
          </Text>
          <ul className='m-0 w-full list-none space-y-3 p-0 text-left'>
            {result?.results.map((item) => (
              <li key={item.email} className='flex flex-wrap justify-between gap-2 text-sm'>
                <Text as='span' color='inherit' className='break-all'>
                  {item.email}
                </Text>
                <Text as='span' type='secondary'>
                  {item.error ||
                    item.invitation?.error ||
                    (item.invitation && REFERRAL_STATUS_LABELS[item.invitation.status])}
                </Text>
              </li>
            ))}
          </ul>
          {error ? (
            <Text as='p' fontSize={14} type='danger' role='alert'>
              {error}
            </Text>
          ) : null}
          {hasFailed ? (
            <Button loading={loading} disabled={!retryable.length} onClick={retryFailed}>
              {retryable.length ? '重试发送失败的邀请' : '请等待 60 秒后重试'}
            </Button>
          ) : null}
          <Button block size='large' shape='round' type='primary' onClick={close}>
            完成
          </Button>
          <Button block size='large' onClick={showHistory}>
            跟踪邀请 · 已发送 {sentCount} 个
          </Button>
          <Button type='text' onClick={returnToSend}>
            继续邀请
          </Button>
        </section>
      ) : null}
    </Modal>
  )
}
