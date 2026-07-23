'use client'

import { ProviderCombine } from '@pure/ui'
import { Flex, Typography, Input, Switch } from 'antd'
import { cssVar } from 'antd-style'
import { Eye, EyeOff } from 'lucide-react'
import { memo, useState } from 'react'

import { getSettingsProviderMeta, PROVIDER_DEFAULT_BASE_URLS } from '../../const'
import { useProviderConfigStore } from '../../store/useProviderConfigStore'
import { providerDetailStyles as styles } from '../../styles'
import { type ProviderId } from '../../types'
import Checker from './Checker'

interface ProviderConfigProps {
  id: ProviderId
}

const ProviderConfig = memo<ProviderConfigProps>(({ id }) => {
  const meta = getSettingsProviderMeta(id)
  const config = useProviderConfigStore((s) => s.configs[id])
  const patchConfig = useProviderConfigStore((s) => s.patchConfig)
  const setEnabled = useProviderConfigStore((s) => s.setEnabled)
  const [showApiKey, setShowApiKey] = useState(false)

  const enabled = config?.enabled ?? false
  const apiKey = config?.apiKey ?? ''
  const baseURL = config?.baseURL ?? ''

  return (
    <Flex vertical gap={8} style={{ width: '100%' }}>
      <Flex align='center' justify='space-between' style={{ paddingBlock: 8, width: '100%' }}>
        <ProviderCombine provider={id} size={32} />
        <Switch checked={enabled} onChange={(checked) => setEnabled(id, checked)} />
      </Flex>

      <div className={styles.row}>
        <Flex vertical className={styles.rowLabel} gap={4}>
          <Typography.Text style={{ fontWeight: 500 }}>API Key</Typography.Text>
          <Typography.Text type='secondary' style={{ fontSize: 12 }}>
            请填写你的 {meta.name} API Key1
          </Typography.Text>
        </Flex>
        <div className={styles.rowBody}>
          <Input
            placeholder={`${meta.name} API Key`}
            suffix={
              <Flex vertical onClick={() => setShowApiKey((prev) => !prev)} style={{ cursor: 'pointer' }}>
                {showApiKey ? (
                  <EyeOff color={cssVar.colorTextDescription} size={16} />
                ) : (
                  <Eye color={cssVar.colorTextDescription} size={16} />
                )}
              </Flex>
            }
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => patchConfig(id, { apiKey: e.target.value })}
          />
        </div>
      </div>

      <div className={styles.row}>
        <Flex vertical className={styles.rowLabel} gap={4}>
          <Typography.Text style={{ fontWeight: 500 }}>API 代理地址</Typography.Text>
          <Typography.Text type='secondary' style={{ fontSize: 12 }}>
            必须包含 http(s)://
          </Typography.Text>
        </Flex>
        <div className={styles.rowBody}>
          <Input
            placeholder={PROVIDER_DEFAULT_BASE_URLS[id]}
            value={baseURL}
            onChange={(e) => patchConfig(id, { baseURL: e.target.value })}
          />
        </div>
      </div>

      <div className={styles.row}>
        <Flex vertical className={styles.rowLabel} gap={4}>
          <Typography.Text style={{ fontWeight: 500 }}>连通性检查</Typography.Text>
          <Typography.Text type='secondary' style={{ fontSize: 12 }}>
            测试 API Key 与代理地址是否正确填写
          </Typography.Text>
        </Flex>
        <div className={styles.rowBody}>
          <Checker provider={id} />
        </div>
      </div>

      <Typography.Text className={styles.hint} style={{ marginBlockStart: 8 }}>
        API Key 仅保存在本地浏览器存储中，不会上传到服务器。
      </Typography.Text>
    </Flex>
  )
})

ProviderConfig.displayName = 'ProviderConfig'

export default ProviderConfig
