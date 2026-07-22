'use client'

import { Button, Flexbox, Text } from '@lobehub/ui'
import { useModalContext } from '@lobehub/ui/base-ui'
import { Alert, QRCode, Spin } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { LinkIcon, RefreshCw } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

import { createModal } from '@/libs/modal'

import { PlatformAvatar } from './PlatformAvatar'
import { fetchWechatQrCode, pollWechatQrStatus } from './wechatApi'

const QR_POLL_INTERVAL_MS = 2000
const QR_SIZE = 240

const styles = createStaticStyles(({ css }) => ({
  // 对齐 lobe LinkModal/Telegram：二维码中间叠平台 Logo
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
  onAuthenticated: (credentials: WechatAuthCredentials) => void
}

const QrCodeContent = memo<QrCodeContentProps>(({ onAuthenticated }) => {
  const { close } = useModalContext()
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

          timerRef.current = setTimeout(poll, QR_POLL_INTERVAL_MS)
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return
          if (pollingRef.current) {
            timerRef.current = setTimeout(poll, QR_POLL_INTERVAL_MS)
          }
        }
      }

      timerRef.current = setTimeout(poll, QR_POLL_INTERVAL_MS)
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
    <Flexbox align='center' gap={16} style={{ paddingBlock: 16 }}>
      {loading && <Spin size='large' />}
      {qrImgUrl && !error && (
        <div className={styles.qrWrap}>
          <QRCode bordered={false} size={QR_SIZE} value={qrImgUrl} />
          <div className={styles.qrIconOverlay}>
            <PlatformAvatar platform='wechat' size={44} />
          </div>
        </div>
      )}
      {statusText && !error && <Text type='secondary'>{statusText}</Text>}
      {error && (
        <>
          <Alert showIcon message={error} type='warning' />
          <Button icon={RefreshCw} onClick={() => void handleRefresh()}>
            刷新二维码
          </Button>
        </>
      )}
    </Flexbox>
  )
})

QrCodeContent.displayName = 'QrCodeContent'

const openQrCodeAuthModal = (onAuthenticated: (credentials: WechatAuthCredentials) => void) => {
  return createModal({
    content: <QrCodeContent onAuthenticated={onAuthenticated} />,
    footer: null,
    maskClosable: true,
    title: '微信扫码连接',
    width: 460,
  })
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
    <Button disabled={disabled} icon={LinkIcon} type='primary' onClick={handleOpen}>
      {buttonLabel}
    </Button>
  )
})

QrCodeAuth.displayName = 'QrCodeAuth'

export default QrCodeAuth
