'use client'

import { ProviderCombine } from '@lobehub/icons'
import { Flexbox, Input, Text } from '@lobehub/ui'
import { Switch } from 'antd'
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
    <Flexbox gap={8} width='100%'>
      <Flexbox
        horizontal
        align='center'
        justify='space-between'
        paddingBlock={8}
        width='100%'
      >
        <ProviderCombine provider={id} size={32} />
        <Switch checked={enabled} onChange={(checked) => setEnabled(id, checked)} />
      </Flexbox>

      <div className={styles.row}>
        <Flexbox className={styles.rowLabel} gap={4}>
          <Text weight={500}>API Key</Text>
          <Text fontSize={12} type='secondary'>
            请填写你的 {meta.name} API Key
          </Text>
        </Flexbox>
        <div className={styles.rowBody}>
          <Input
            placeholder={`${meta.name} API Key`}
            suffix={
              <Flexbox
                style={{ cursor: 'pointer' }}
                onClick={() => setShowApiKey((prev) => !prev)}
              >
                {showApiKey ? (
                  <EyeOff color={cssVar.colorTextDescription} size={16} />
                ) : (
                  <Eye color={cssVar.colorTextDescription} size={16} />
                )}
              </Flexbox>
            }
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => patchConfig(id, { apiKey: e.target.value })}
          />
        </div>
      </div>

      <div className={styles.row}>
        <Flexbox className={styles.rowLabel} gap={4}>
          <Text weight={500}>API 代理地址</Text>
          <Text fontSize={12} type='secondary'>
            必须包含 http(s)://
          </Text>
        </Flexbox>
        <div className={styles.rowBody}>
          <Input
            placeholder={PROVIDER_DEFAULT_BASE_URLS[id]}
            value={baseURL}
            onChange={(e) => patchConfig(id, { baseURL: e.target.value })}
          />
        </div>
      </div>

      <div className={styles.row}>
        <Flexbox className={styles.rowLabel} gap={4}>
          <Text weight={500}>连通性检查</Text>
          <Text fontSize={12} type='secondary'>
            测试 API Key 与代理地址是否正确填写
          </Text>
        </Flexbox>
        <div className={styles.rowBody}>
          <Checker provider={id} />
        </div>
      </div>

      <Text className={styles.hint} style={{ marginBlockStart: 8 }}>
        API Key 仅保存在本地浏览器存储中，不会上传到服务器。
      </Text>
    </Flexbox>
  )
})

ProviderConfig.displayName = 'ProviderConfig'

export default ProviderConfig
