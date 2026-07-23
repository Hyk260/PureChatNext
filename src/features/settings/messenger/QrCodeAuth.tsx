'use client'

import { Flex, Typography, Button, Alert, QRCode, Spin } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { LinkIcon, RefreshCw } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

import { modal } from '@/components/AntdStaticMethods'

import { PlatformAvatar } from './PlatformAvatar'
import { fetchWechatQrCode, pollWechatQrStatus } from './wechatApi'

const QR_POLL_INTERVAL_MS = 2000
// 正常状态（wait / scaned）续轮间隔：iLink 是「等待状态变化」的长轮询，
// scaned 只会发给正在挂起的那次请求；续轮间隔过大会有空窗漏掉 scaned。
// 长轮询本身已提供节奏，这里用小间隔保持几乎持续挂起。
const QR_RESCHEDULE_MS = 300
const QR_SIZE = 240
// 加载/二维码/状态文字的合计占位高度，用于各状态保持一致高度避免跳动
// qrWrap: QR_SIZE(240) + padding(14*2) + border(1*2) = 270；+ gap(16) + 状态行(~22) ≈ 308
const QR_PLACEHOLDER_HEIGHT = QR_SIZE + 28 + 2 + 16 + 22

const styles = createStaticStyles(({ css }) => ({
  // 二维码中间叠平台 Logo
  qrIconOverlay: css`
    pointer-events: none;

    position: absolute;
    z-index: 1;
    inset-block-start: 50%;
    inset-inline-start: 50%;
    transform: translate(-50%, -50%);

    border: 3px solid ${cssVar.colorBgContainer};
    border-radius: 50%;

    line-height: 0;
  `,
  qrWrap: css`
    position: relative;

    padding: 14px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 16px;

    background: ${cssVar.colorBgContainer};
  `,
}))

export type WechatAuthCredentials = {
  botId: string
  botToken: string
  userId: string
}

interface QrCodeContentProps {
  close: () => void
  onAuthenticated: (credentials: WechatAuthCredentials) => void
}

const QrCodeContent = memo<QrCodeContentProps>(({ close, onAuthenticated }) => {
  const [qrImgUrl, setQrImgUrl] = useState<string>()
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const pollingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const onAuthenticatedRef = useRef(onAuthenticated)
  useEffect(() => {
    onAuthenticatedRef.current = onAuthenticated
  }, [onAuthenticated])

  const stopPolling = useCallback(() => {
    pollingRef.current = false
    abortRef.current?.abort()
    abortRef.current = null
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const beginPolling = useCallback(
    (qrcode: string) => {
      pollingRef.current = true

      const poll = async () => {
        if (!pollingRef.current) return

        const ac = new AbortController()
        abortRef.current = ac

        try {
          const res = await pollWechatQrStatus(qrcode, ac.signal)
          if (!pollingRef.current) return

          setStatus(res.status)

          if (res.status === 'confirmed' && res.bot_token) {
            stopPolling()
            onAuthenticatedRef.current({
              botId: res.ilink_bot_id || '',
              botToken: res.bot_token,
              userId: res.ilink_user_id || '',
            })
            close()
            return
          }

          if (res.status === 'expired') {
            stopPolling()
            setError('二维码已过期，请刷新后重试')
            return
          }

          // wait / scaned：小间隔续轮，保持长轮询几乎持续挂起，避免漏掉 scaned
          timerRef.current = setTimeout(poll, QR_RESCHEDULE_MS)
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return
          if (pollingRef.current) {
            timerRef.current = setTimeout(poll, QR_POLL_INTERVAL_MS)
          }
        }
      }

      timerRef.current = setTimeout(poll, QR_RESCHEDULE_MS)
    },
    [close, stopPolling]
  )

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const qr = await fetchWechatQrCode()
        if (cancelled) return
        setQrImgUrl(qr.qrcode_img_content)
        setStatus('wait')
        setLoading(false)
        beginPolling(qr.qrcode)
      } catch (err: unknown) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : '获取二维码失败')
        setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
      stopPolling()
    }
  }, [beginPolling, stopPolling])

  const handleRefresh = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    setStatus('')
    setQrImgUrl(undefined)
    stopPolling()

    try {
      const qr = await fetchWechatQrCode()
      setQrImgUrl(qr.qrcode_img_content)
      setStatus('wait')
      setLoading(false)
      beginPolling(qr.qrcode)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '获取二维码失败')
      setLoading(false)
    }
  }, [beginPolling, stopPolling])

  const statusText = status === 'wait' ? '请使用微信扫一扫' : status === 'scaned' ? '已扫码，请在手机上确认' : ''

  return (
    <Flex vertical align='center' gap={16} style={{ paddingBlock: 16 }}>
      {loading && (
        // 预留与「二维码盒子 + 状态文字」等高的占位，避免加载完成时高度突变跳动
        <div
          style={{
            height: QR_PLACEHOLDER_HEIGHT,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Spin size='large' />
        </div>
      )}
      {qrImgUrl && !error && (
        <div className={styles.qrWrap}>
          <QRCode bordered={false} size={QR_SIZE} value={qrImgUrl} />
          <div className={styles.qrIconOverlay}>
            <PlatformAvatar platform='wechat' size={44} />
          </div>
        </div>
      )}
      {statusText && !error && <Typography.Text type='secondary'>{statusText}</Typography.Text>}
      {error && (
        <div
          style={{
            minHeight: QR_PLACEHOLDER_HEIGHT,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <Alert showIcon title={error} type='warning' />
          <Button icon={<RefreshCw size={16} />} onClick={() => void handleRefresh()}>
            刷新二维码
          </Button>
        </div>
      )}
    </Flex>
  )
})

QrCodeContent.displayName = 'QrCodeContent'

const openQrCodeAuthModal = (onAuthenticated: (credentials: WechatAuthCredentials) => void) => {
  const instance = modal.info({
    content: <QrCodeContent close={() => instance.destroy()} onAuthenticated={onAuthenticated} />,
    footer: null,
    icon: null,
    maskClosable: true,
    title: '微信扫码连接',
    width: 460,
  })
  return instance
}

interface QrCodeAuthProps {
  buttonLabel?: string
  disabled?: boolean
  onAuthenticated: (credentials: WechatAuthCredentials) => void
}

const QrCodeAuth = memo<QrCodeAuthProps>(({ buttonLabel = '连接', disabled, onAuthenticated }) => {
  const handleOpen = () => {
    if (disabled) return
    openQrCodeAuthModal(onAuthenticated)
  }

  return (
    <Button disabled={disabled} icon={<LinkIcon size={16} />} type='primary' onClick={handleOpen}>
      {buttonLabel}
    </Button>
  )
})

QrCodeAuth.displayName = 'QrCodeAuth'

export default QrCodeAuth
