'use client'

import { Button as AntButton, QRCode, Radio, Spin } from 'antd'
import { Alert, Button, Flex, Input, Select, Text } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { LinkIcon, RefreshCw } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

import { modal } from '@/components/AntdStaticMethods'

import { PlatformAvatar } from './PlatformAvatar'
import {
  bindQQ,
  cancelQQQrLogin,
  completeQQQrLogin,
  isQQQrSessionMissingError,
  pollQQQrLogin,
  startQQQrLogin,
} from './qqApi'
import type { QQConnectionMode, QQProviderId, QQQrStatus } from './qqApi'

const QR_SIZE = 240
const POLL_MS = 1_500
const SESSION_MISSING_RETRY_MS = 1_000
const MAX_SESSION_MISSING_RETRIES = 2
// qrWrap: QR_SIZE(240) + padding(12*2) + border(1*2) = 266；+ gap(12) + 状态行(~22) ≈ 300
const QR_PLACEHOLDER_HEIGHT = 318

type ConnectMode = 'qr' | QQConnectionMode

const styles = createStaticStyles(({ css }) => ({
  qrIcon: css`
    pointer-events: none;
    position: absolute;
    inset-block-start: 50%;
    inset-inline-start: 50%;
    transform: translate(-50%, -50%);
    border: 3px solid ${cssVar.colorBgContainer};
    border-radius: 50%;
    line-height: 0;
  `,
  qrWrap: css`
    position: relative;
    padding: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 14px;
    background: ${cssVar.colorBgContainer};
  `,
}))

interface QQConnectContentProps {
  agentId: string
  close: () => void
  gatewaySupported: boolean
  model: string
  onConnected: () => Promise<void> | void
  provider: QQProviderId
}

const QQConnectContent = memo<QQConnectContentProps>(
  ({ agentId, close, gatewaySupported, model, onConnected, provider }) => {
    const [mode, setMode] = useState<ConnectMode>(gatewaySupported ? 'qr' : 'webhook')
    const [appId, setAppId] = useState('')
    const [appSecret, setAppSecret] = useState('')
    const [qrStatus, setQrStatus] = useState<QQQrStatus>()
    const [sessionId, setSessionId] = useState<string>()
    const [selectedAppId, setSelectedAppId] = useState<string>()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string>()
    const sessionRef = useRef<string | undefined>(undefined)
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const abortRef = useRef<AbortController | undefined>(undefined)
    const attemptRef = useRef(0)

    const cancelSession = useCallback(() => {
      attemptRef.current += 1
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = undefined
      abortRef.current?.abort()
      abortRef.current = undefined
      const current = sessionRef.current
      sessionRef.current = undefined
      setSessionId(undefined)
      if (current) void cancelQQQrLogin(current)
    }, [])

    const finish = useCallback(async () => {
      cancelSession()
      try {
        await onConnected()
      } finally {
        close()
      }
    }, [cancelSession, close, onConnected])

    const poll = useCallback(
      (id: string) => {
        const run = async (missingRetries = 0) => {
          if (sessionRef.current !== id) return
          const controller = new AbortController()
          abortRef.current = controller
          try {
            const status = await pollQQQrLogin(id, controller.signal)
            if (sessionRef.current !== id) return
            setQrStatus(status)
            if (status.status === 'connected') {
              await finish()
              return
            }
            if (status.status === 'failed') {
              setError(status.message)
              return
            }
            if (status.status === 'selecting') setSelectedAppId((value) => value || status.appIds[0])
            timerRef.current = setTimeout(run, POLL_MS)
          } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return
            if (isQQQrSessionMissingError(err)) {
              if (sessionRef.current !== id) return
              if (missingRetries < MAX_SESSION_MISSING_RETRIES) {
                timerRef.current = setTimeout(() => void run(missingRetries + 1), SESSION_MISSING_RETRY_MS)
                return
              }
              sessionRef.current = undefined
              setSessionId(undefined)
              setQrStatus(undefined)
              setError('QQ 扫码会话已失效，请重新获取二维码')
              return
            }
            if (sessionRef.current === id) timerRef.current = setTimeout(run, POLL_MS)
          }
        }
        timerRef.current = setTimeout(run, POLL_MS)
      },
      [finish]
    )

    const startQr = useCallback(async () => {
      cancelSession()
      const attempt = attemptRef.current
      setLoading(true)
      setError(undefined)
      setQrStatus(undefined)
      setSelectedAppId(undefined)
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const result = await startQQQrLogin({ agentId, model, provider }, controller.signal)
        if (attemptRef.current !== attempt) {
          void cancelQQQrLogin(result.sessionId)
          return
        }
        sessionRef.current = result.sessionId
        setSessionId(result.sessionId)
        const { sessionId: _sessionId, ...status } = result
        setQrStatus(status)
        poll(result.sessionId)
      } catch (err) {
        if (attemptRef.current === attempt) {
          setError(err instanceof Error ? err.message : '获取 QQ 二维码失败')
        }
      } finally {
        if (attemptRef.current === attempt) setLoading(false)
      }
    }, [agentId, cancelSession, model, poll, provider])

    useEffect(() => {
      if (mode === 'qr' && gatewaySupported) void startQr()
      else cancelSession()
      return cancelSession
    }, [cancelSession, gatewaySupported, mode, startQr])

    const handleManualBind = async () => {
      if (!appId.trim() || !appSecret.trim()) {
        setError('请填写 App ID 与 App Secret')
        return
      }
      setLoading(true)
      setError(undefined)
      try {
        await bindQQ({
          agentId,
          appId: appId.trim(),
          appSecret: appSecret.trim(),
          connectionMode: mode as QQConnectionMode,
          model,
          provider,
        })
        await finish()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'QQ 绑定失败')
      } finally {
        setLoading(false)
      }
    }

    const handleSelection = async () => {
      if (!sessionId || !selectedAppId) return
      setLoading(true)
      setError(undefined)
      try {
        await completeQQQrLogin(sessionId, selectedAppId)
        await finish()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'QQ 绑定失败')
      } finally {
        setLoading(false)
      }
    }

    return (
      <Flex className='flex-col gap-[18px] py-1'>
        <Text type='secondary'>选择连接方式，将当前助手绑定到 QQ 机器人。</Text>
        <Radio.Group value={mode} onChange={(event) => setMode(event.target.value as ConnectMode)}>
          <Radio disabled={!gatewaySupported} value='qr'>
            扫码绑定
          </Radio>
          <Radio disabled={!gatewaySupported} value='websocket'>
            WebSocket 长连接
          </Radio>
          <Radio value='webhook'>使用 URL 回调</Radio>
        </Radio.Group>

        {!gatewaySupported && (
          <Alert
            showIcon
            type='info'
            title='当前部署仅支持 URL 回调'
            description='扫码和 WebSocket 需要开启内置 Channel Gateway 的本地或 Docker 单实例环境。'
          />
        )}

        {mode === 'qr' ? (
          <Flex className='flex-col items-center gap-3' style={{ minHeight: QR_PLACEHOLDER_HEIGHT }}>
            {loading && !qrStatus ? (
              <Flex className='flex-col-center w-full' style={{ height: QR_PLACEHOLDER_HEIGHT }}>
                <Spin size='large' />
              </Flex>
            ) : null}
            {qrStatus?.status === 'waiting' && (
              <>
                <div className={styles.qrWrap}>
                  <QRCode bordered={false} size={QR_SIZE} value={qrStatus.qrCodeUrl} />
                  <div className={styles.qrIcon}>
                    <PlatformAvatar platform='qq' size={42} />
                  </div>
                </div>
                <Text type='secondary'>请使用手机 QQ 扫描二维码并确认连接</Text>
              </>
            )}
            {qrStatus?.status === 'binding' && (
              <>
                <Spin size='large' />
                <Text type='secondary'>授权成功，正在连接 QQ…</Text>
              </>
            )}
            {qrStatus?.status === 'selecting' && (
              <Flex className='flex-col gap-3 w-full'>
                <Alert showIcon type='info' title='请选择要连接的 QQ 机器人' />
                <Select
                  options={qrStatus.appIds.map((value) => ({ label: `QQ Bot ${value}`, value }))}
                  value={selectedAppId}
                  onChange={setSelectedAppId}
                />
                <AntButton block loading={loading} type='primary' onClick={() => void handleSelection()}>
                  连接所选机器人
                </AntButton>
              </Flex>
            )}
            {error && (
              <Flex className='flex-col-center '>
                <Alert showIcon type='warning' title={error} />
                <AntButton icon={<RefreshCw size={16} />} onClick={() => void startQr()}>
                  重新获取二维码
                </AntButton>
              </Flex>
            )}
          </Flex>
        ) : (
          <Flex className='flex-col gap-3'>
            <Input placeholder='QQ 机器人 App ID' value={appId} onChange={(event) => setAppId(event.target.value)} />
            <Input.Password
              placeholder='QQ 机器人 App Secret'
              value={appSecret}
              onChange={(event) => setAppSecret(event.target.value)}
            />
            <Text type='secondary' style={{ fontSize: 13 }}>
              {mode === 'websocket'
                ? '由内置 Gateway 维护长连接，无需公网回调地址。'
                : '保存后将在设置页显示需要配置到 QQ 开放平台的回调地址。'}
            </Text>
            {error && <Alert showIcon type='warning' title={error} />}
            <Flex className='flex-row justify-end gap-2'>
              <AntButton onClick={close}>取消</AntButton>
              <AntButton loading={loading} type='primary' onClick={() => void handleManualBind()}>
                注册
              </AntButton>
            </Flex>
          </Flex>
        )}
      </Flex>
    )
  }
)

QQConnectContent.displayName = 'QQConnectContent'

export function openQQConnectModal(props: Omit<QQConnectContentProps, 'close'>) {
  const instance = modal.info({
    content: <QQConnectContent {...props} close={() => instance.destroy()} />,
    footer: null,
    icon: null,
    mask: { closable: true },
    title: '注册 QQ 通道',
    width: 620,
  })
  return instance
}

export const QQConnectButton = memo<Omit<QQConnectContentProps, 'close'>>((props) => (
  <Button icon={<LinkIcon size={16} />} type='primary' onClick={() => openQQConnectModal(props)}>
    连接
  </Button>
))

QQConnectButton.displayName = 'QQConnectButton'
