'use client'

import { Alert, Flexbox, Input, Modal, Text } from '@pure/ui'
import { useMemo, useState } from 'react'

import { getSettingsProviderMeta } from '../../const'
import type { ProviderId } from '../../types'

export const DEFAULT_HEALTH_TIMEOUT_SECONDS = 15
export const MIN_HEALTH_TIMEOUT_SECONDS = 1
export const MAX_HEALTH_TIMEOUT_SECONDS = 120

interface HealthCheckModalProps {
  enabledModelCount: number
  loading: boolean
  open: boolean
  provider: ProviderId
  onCancel: () => void
  onStart: (timeoutMs: number) => void
}

const HealthCheckModal = ({
  enabledModelCount,
  loading,
  open,
  provider,
  onCancel,
  onStart,
}: HealthCheckModalProps) => {
  const meta = getSettingsProviderMeta(provider)
  const [timeoutSeconds, setTimeoutSeconds] = useState(String(DEFAULT_HEALTH_TIMEOUT_SECONDS))
  const parsedTimeout = Number(timeoutSeconds)
  const validTimeout = Number.isFinite(parsedTimeout) && parsedTimeout >= MIN_HEALTH_TIMEOUT_SECONDS && parsedTimeout <= MAX_HEALTH_TIMEOUT_SECONDS

  const description = useMemo(
    () => `将检查 ${meta.name} 的 ${enabledModelCount} 个已启用模型。每个模型会发送一次最小请求，可能产生模型调用费用。`,
    [enabledModelCount, meta.name]
  )

  return (
    <Modal
      cancelText='取消'
      confirmLoading={loading}
      destroyOnHidden
      okButtonProps={{ disabled: !validTimeout }}
      okText='开始检查'
      open={open}
      title='模型健康检测'
      onCancel={onCancel}
      onOk={() => {
        if (!validTimeout) return
        onStart(Math.round(parsedTimeout * 1000))
      }}
    >
      <Flexbox gap={16}>
        <Alert showIcon type='warning' message='健康检查会发送真实请求，请谨慎使用。按次收费的模型可能产生额外费用。' />
        <Text type='secondary'>{description}</Text>
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
        {!validTimeout ? (
          <Text type='danger' style={{ fontSize: 12 }}>
            请输入 1–120 秒的超时时间
          </Text>
        ) : null}
      </Flexbox>
    </Modal>
  )
}

HealthCheckModal.displayName = 'HealthCheckModal'

export default HealthCheckModal
