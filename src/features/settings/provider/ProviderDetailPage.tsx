'use client'

import { ProviderCombine } from '@lobehub/icons'
import { Flexbox, Input, Text } from '@lobehub/ui'
import { Switch } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { Eye, EyeOff } from 'lucide-react'
import { memo, useState } from 'react'

import { getSettingsProviderMeta } from './const'
import { useProviderConfigStore } from './store/useProviderConfigStore'
import type { ProviderId } from './types'

const styles = createStaticStyles(({ css }) => ({
  hint: css`
    font-size: 12px;
    color: ${cssVar.colorTextDescription};
    text-align: center;
    opacity: 0.66;
  `,
  page: css`
    width: 100%;
    max-width: 1024px;
    margin-inline: auto;
    padding-block: 24px 64px;
    padding-inline: 24px;
  `,
  row: css`
    display: flex;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;
    width: 100%;
    padding-block: 16px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  rowBody: css`
    flex: none;
    width: min(360px, 48%);
  `,
  rowLabel: css`
    flex: 1;
    min-width: 0;
  `,
}))

interface ProviderDetailPageProps {
  id: ProviderId
}

const ProviderDetailPage = memo<ProviderDetailPageProps>(({ id }) => {
  const meta = getSettingsProviderMeta(id)
  const config = useProviderConfigStore((s) => s.configs[id])
  const patchConfig = useProviderConfigStore((s) => s.patchConfig)
  const setEnabled = useProviderConfigStore((s) => s.setEnabled)
  const [showApiKey, setShowApiKey] = useState(false)

  return (
    <Flexbox className={styles.page} gap={8} width='100%'>
      <Flexbox
        horizontal
        align='center'
        justify='space-between'
        paddingBlock={8}
        width='100%'
      >
        <ProviderCombine provider={id} size={32} />
        <Switch checked={config.enabled} onChange={(checked) => setEnabled(id, checked)} />
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
            value={config.apiKey}
            onChange={(e) => patchConfig(id, { apiKey: e.target.value })}
          />
        </div>
      </div>

      <div className={styles.row}>
        <Flexbox className={styles.rowLabel} gap={4}>
          <Text weight={500}>API 代理地址</Text>
          <Text fontSize={12} type='secondary'>
            除默认地址外，支持使用自定义 API 代理地址
          </Text>
        </Flexbox>
        <div className={styles.rowBody}>
          <Input
            placeholder='https://api.example.com'
            value={config.baseURL}
            onChange={(e) => patchConfig(id, { baseURL: e.target.value })}
          />
        </div>
      </div>

      <Text className={styles.hint} style={{ marginBlockStart: 24 }}>
        API Key 仅保存在本地浏览器存储中，不会上传到服务器。
      </Text>
    </Flexbox>
  )
})

ProviderDetailPage.displayName = 'ProviderDetailPage'

export default ProviderDetailPage
