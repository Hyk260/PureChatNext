'use client'

import { Alert, Flexbox, Input, Modal, Switch, Text } from '@pure/ui'
import { useMemo, useState } from 'react'

import { getSettingsProviderMeta } from '../../const'
import type { ProviderId } from '../../types'
import {
  DEFAULT_HEALTH_CHECK_CONCURRENCY,
  MAX_HEALTH_CHECK_CONCURRENCY,
  MIN_HEALTH_CHECK_CONCURRENCY,
} from './healthCheck'

export const DEFAULT_HEALTH_TIMEOUT_SECONDS = 15
export const MIN_HEALTH_TIMEOUT_SECONDS = 1
export const MAX_HEALTH_TIMEOUT_SECONDS = 120
export const DEFAULT_HEALTH_CONCURRENCY_ENABLED = true

interface HealthCheckModalProps {
  enabledModelCount: number
  loading: boolean
  open: boolean
  provider: ProviderId
  onCancel: () => void
  onStart: (timeoutMs: number, concurrency: number) => void
}

const HealthCheckModal = ({ enabledModelCount, loading, open, provider, onCancel, onStart }: HealthCheckModalProps) => {
  const meta = getSettingsProviderMeta(provider)
  const [timeoutSeconds, setTimeoutSeconds] = useState(String(DEFAULT_HEALTH_TIMEOUT_SECONDS))
  const [concurrencyEnabled, setConcurrencyEnabled] = useState(DEFAULT_HEALTH_CONCURRENCY_ENABLED)
  const [concurrencyValue, setConcurrencyValue] = useState(String(DEFAULT_HEALTH_CHECK_CONCURRENCY))
  const parsedTimeout = Number(timeoutSeconds)
  const parsedConcurrency = Number(concurrencyValue)
  const validTimeout =
    Number.isFinite(parsedTimeout) &&
    parsedTimeout >= MIN_HEALTH_TIMEOUT_SECONDS &&
    parsedTimeout <= MAX_HEALTH_TIMEOUT_SECONDS
  const validConcurrency =
    !concurrencyEnabled ||
    (Number.isInteger(parsedConcurrency) &&
      parsedConcurrency >= MIN_HEALTH_CHECK_CONCURRENCY &&
      parsedConcurrency <= MAX_HEALTH_CHECK_CONCURRENCY)

  const description = useMemo(
    () =>
      `将检查 ${meta.name} 的 ${enabledModelCount} 个已启用模型。每个模型会发送一次最小请求，可能产生模型调用费用。`,
    [enabledModelCount, meta.name]
  )

  return (
    <Modal
      cancelText='取消'
      confirmLoading={loading}
      destroyOnHidden
      okButtonProps={{ disabled: !validTimeout || !validConcurrency }}
      okText='开始检查'
      open={open}
      title='模型健康检测'
      onCancel={onCancel}
      onOk={() => {
        if (!validTimeout) return
        if (!validConcurrency) return
        onStart(Math.round(parsedTimeout * 1000), concurrencyEnabled ? parsedConcurrency : MIN_HEALTH_CHECK_CONCURRENCY)
      }}
    >
      <Flexbox gap={16}>
        <Alert showIcon type='warning' message='健康检查会发送真实请求，请谨慎使用。按次收费的模型可能产生额外费用。' />
        <Text type='secondary'>{description}</Text>
        <Flexbox gap={12}>
          <Flexbox horizontal align='center' justify='space-between'>
            <Text strong>超时时间</Text>
            <Input
              max={MAX_HEALTH_TIMEOUT_SECONDS}
              min={MIN_HEALTH_TIMEOUT_SECONDS}
              suffix='秒'
              type='number'
              value={timeoutSeconds}
              style={{ width: 160 }}
              onChange={(event) => setTimeoutSeconds(event.target.value)}
            />
          </Flexbox>
          {!validTimeout ? <Text type='danger'>请输入 1–120 秒的超时时间</Text> : null}
        </Flexbox>

        <Flexbox gap={12}>
          <Flexbox horizontal align='center' justify='space-between'>
            <Text strong>并发检测</Text>
            <Switch checked={concurrencyEnabled} onChange={setConcurrencyEnabled} />
          </Flexbox>
          <Flexbox horizontal align='center' justify='space-between'>
            <Text strong type={!concurrencyEnabled ? 'secondary' : undefined}>
              并发数量
            </Text>
            <Input
              disabled={!concurrencyEnabled}
              max={MAX_HEALTH_CHECK_CONCURRENCY}
              min={MIN_HEALTH_CHECK_CONCURRENCY}
              suffix='个'
              type='number'
              value={concurrencyValue}
              style={{ width: 160 }}
              onChange={(event) => setConcurrencyValue(event.target.value)}
            />
          </Flexbox>
          {concurrencyEnabled && !validConcurrency ? <Text type='danger'>请输入 1–4 个并发请求</Text> : null}
        </Flexbox>
      </Flexbox>
    </Modal>
  )
}

HealthCheckModal.displayName = 'HealthCheckModal'

export default HealthCheckModal
