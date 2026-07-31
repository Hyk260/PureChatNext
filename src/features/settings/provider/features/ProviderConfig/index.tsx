'use client'

import { Flexbox, Input, InputPassword, ProviderCombine, Switch, Text } from '@pure/ui'
import { memo } from 'react'

import { getSettingsProviderMeta, isServerManagedProvider, PROVIDER_DEFAULT_BASE_URLS } from '../../const'
import { useProviderConfigStore } from '../../store/useProviderConfigStore'
import { providerDetailStyles as styles } from '../../styles'
import type { ProviderId } from '../../types'
import Checker from './Checker'

interface ProviderConfigProps {
  id: ProviderId
}

const ProviderConfig = memo<ProviderConfigProps>(({ id }) => {
  const meta = getSettingsProviderMeta(id)
  const config = useProviderConfigStore((s) => s.configs[id])
  const patchConfig = useProviderConfigStore((s) => s.patchConfig)
  const setEnabled = useProviderConfigStore((s) => s.setEnabled)
  const serverManaged = isServerManagedProvider(id)

  const enabled = config?.enabled ?? false
  const apiKey = config?.apiKey ?? ''
  const baseURL = config?.baseURL ?? ''

  return (
    <Flexbox gap={8} width='100%'>
      <Flexbox horizontal align='center' justify='space-between' style={{ paddingBlock: 8 }} width='100%'>
        <ProviderCombine provider={id} size={32} />
        {serverManaged ? null : (
          <Switch
            aria-label={`${enabled ? '停用' : '启用'} ${meta.name}`}
            checked={enabled}
            onChange={(checked) => setEnabled(id, checked)}
          />
        )}
      </Flexbox>

      {serverManaged ? (
        <>
          <Text type='secondary' style={{ fontSize: 13 }}>
            PureHub 由 PureChat 官方托管，无需填写 API
            Key。用量计入每月免费积分；用尽后可等待下月重置，或改用下方自配服务商。
          </Text>
          <Text className={styles.hint} style={{ marginBlockStart: 8 }}>
            设置中不提供购买积分入口。
          </Text>
        </>
      ) : (
        <>
          <div className={styles.row}>
            <Flexbox className={styles.rowLabel} gap={4}>
              <Text style={{ fontWeight: 500 }}>API Key</Text>
              <Text type='secondary' style={{ fontSize: 12 }}>
                请填写你的 {meta.name} API Key
              </Text>
            </Flexbox>
            <div className={styles.rowBody}>
              <InputPassword
                placeholder={`${meta.name} API Key`}
                value={apiKey}
                onChange={(e) => patchConfig(id, { apiKey: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.row}>
            <Flexbox className={styles.rowLabel} gap={4}>
              <Text style={{ fontWeight: 500 }}>API 代理地址</Text>
              <Text type='secondary' style={{ fontSize: 12 }}>
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
              <Text style={{ fontWeight: 500 }}>连通性检查</Text>
              <Text type='secondary' style={{ fontSize: 12 }}>
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
        </>
      )}
    </Flexbox>
  )
})

ProviderConfig.displayName = 'ProviderConfig'

export default ProviderConfig
