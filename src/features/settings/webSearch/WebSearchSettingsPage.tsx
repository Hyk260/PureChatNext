import { toast } from '@lobehub/ui'
import { DEFAULT_WEB_SEARCH_SETTINGS } from '@pure/types'
import type { WebSearchSettingsPatch } from '@pure/types'
import { Collapsible, Block, Button, Flex, Text, TextArea, Tooltip } from '@pure/ui'
import { InputNumber, Segmented, Switch } from 'antd'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { useState } from 'react'

import { useApp } from '@/components/AntdStaticMethods'

import { useWebSearchSettings } from './api'
import { ProviderCard } from './ProviderCard'

function NumberSetting({
  value,
  min,
  max,
  label,
  onCommit,
}: {
  value: number
  min: number
  max: number
  label: string
  onCommit: (value: number) => Promise<boolean>
}) {
  const [draft, setDraft] = useState<number | null | undefined>(undefined)
  const commit = async () => {
    const next = Math.min(max, Math.max(min, Math.trunc(draft ?? value)))
    if (next === value || (await onCommit(next))) setDraft(undefined)
  }
  return (
    <InputNumber
      aria-label={label}
      min={min}
      max={max}
      value={draft === undefined ? value : draft}
      onChange={setDraft}
      onBlur={commit}
    />
  )
}

export default function WebSearchSettingsPage() {
  const { data, error, save, reset, saving, mutate } = useWebSearchSettings()
  const { modal } = useApp()
  const config = { ...DEFAULT_WEB_SEARCH_SETTINGS, ...data?.settings }
  const savedBlacklist = config.blacklist.join('\n')
  const [advancedOpen, setAdvancedOpen] = useState(true)
  const toggleAdvanced = () => setAdvancedOpen((open) => !open)
  const [blacklistDraft, setBlacklistDraft] = useState<string>()
  const blacklist = blacklistDraft ?? savedBlacklist
  const blacklistDirty = blacklist !== savedBlacklist
  const persist = async (patch: WebSearchSettingsPatch) => {
    try {
      await save(patch)
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
      return false
    }
  }
  const saveBlacklist = async () => {
    const submitted = blacklistDraft
    const rules = [
      ...new Set(
        blacklist
          .split('\n')
          .map((rule) => rule.trim())
          .filter(Boolean)
      ),
    ]
    if (await persist({ blacklist: rules })) {
      setBlacklistDraft((current) => (current === submitted ? undefined : current))
      toast.success('黑名单已保存')
    }
  }
  const retry = () => {
    mutate().catch(() => toast.error('重新加载失败'))
  }
  const restore = () => {
    modal.confirm({
      title: '恢复服务器配置？',
      content: '将删除当前账号的网络搜索设置及密钥，重新继承服务器配置和产品默认值。',
      onOk: async () => {
        try {
          await reset()
          setBlacklistDraft(undefined)
          toast.success('已恢复服务器配置')
        } catch (error) {
          toast.error(error instanceof Error ? error.message : '恢复失败')
          throw error
        }
      },
    })
  }
  if (error)
    return (
      <Flex className='flex-col gap-3 p-6'>
        <Text type='danger'>{error.message}</Text>
        <Button onClick={retry}>重试</Button>
        <Button onClick={restore}>恢复服务器配置</Button>
      </Flex>
    )
  if (!data)
    return (
      <Text className='p-6' role='status'>
        正在加载网络搜索设置…
      </Text>
    )
  return (
    <Flex className='w-full flex-col gap-5 px-4 py-5 sm:px-8'>
      <Block variant='outlined' className='rounded-2xl p-5 sm:p-6'>
        <Flex className='flex-between gap-4'>
          <Flex className='items-center gap-2'>
            <Text weight={600}>优先使用模型内置 Web 工具</Text>
            <Tooltip title='优先使用模型内置的网页搜索和 URL 获取功能；模型不支持或需要应用黑名单、工具审批时，使用下方服务商。'>
              <Info size={15} className='cursor-help text-muted-foreground' aria-label='内置 Web 工具说明' />
            </Tooltip>
          </Flex>
          <Switch
            aria-label='优先使用模型内置 Web 工具'
            checked={config.modelToolsPreferred}
            onChange={(checked) => persist({ modelToolsPreferred: checked })}
          />
        </Flex>
      </Block>
      <ProviderCard
        key={`search:${data.settings.searchProvider ?? data.server.searchProviders[0]}`}
        capability='search'
        data={data}
        save={save}
      >
        <Button
          type='text'
          className='w-full justify-between'
          aria-expanded={advancedOpen}
          aria-controls='web-search-advanced'
          icon={advancedOpen ? ChevronUp : ChevronDown}
          onClick={toggleAdvanced}
        >
          高级设置
        </Button>
        <Collapsible open={advancedOpen}>
          <Flex id='web-search-advanced' className='flex-col gap-4 pt-3'>
            <Flex className='flex-between-wrap gap-3'>
              <Text>搜索结果个数</Text>
              <Flex className='items-center gap-2'>
                {config.maxResults !== 5 && (
                  <Button size='small' onClick={() => persist({ maxResults: null })}>
                    重置
                  </Button>
                )}
                <NumberSetting
                  label='搜索结果个数'
                  min={1}
                  max={100}
                  value={config.maxResults}
                  onCommit={(value) => persist({ maxResults: value })}
                />
              </Flex>
            </Flex>
            <Flex className='flex-between-wrap gap-3 border-t border-app-border-secondary pt-4'>
              <Text>压缩方法</Text>
              <Segmented
                value={config.compression}
                options={[
                  { label: '不压缩', value: 'none' },
                  { label: '截断', value: 'cutoff' },
                ]}
                onChange={(value) => {
                  if (value === 'none' || value === 'cutoff') persist({ compression: value })
                }}
              />
            </Flex>
            {config.compression === 'cutoff' && (
              <Flex className='flex-between-wrap gap-3'>
                <Text>
                  截断长度{' '}
                  <Tooltip title='整批结果正文的 token 总预算，按最终结果数量均分。'>
                    <Info size={14} className='inline' />
                  </Tooltip>
                </Text>
                <NumberSetting
                  label='截断长度'
                  min={1}
                  max={128000}
                  value={config.cutoffLimit}
                  onCommit={(value) => persist({ cutoffLimit: value })}
                />
              </Flex>
            )}
            <Flex className='flex-col gap-2 border-t border-app-border-secondary pt-4'>
              <Text weight={500}>黑名单</Text>
              <TextArea
                aria-label='黑名单'
                rows={4}
                value={blacklist}
                onChange={(event) => setBlacklistDraft(event.target.value)}
                placeholder={'每行一条规则\n匹配模式：*://*.example.com/*\n正则表达式：/example\\.(net|org)/'}
              />
              {blacklistDirty && (
                <Button className='self-end' loading={saving} onClick={saveBlacklist}>
                  保存黑名单
                </Button>
              )}
            </Flex>
            <Text type='secondary' fontSize={12}>
              结果数量和正文压缩适用于外部搜索及抓取；实际数量可能低于上限。有黑名单时使用外部服务以保证过滤生效。
            </Text>
          </Flex>
        </Collapsible>
      </ProviderCard>
      <ProviderCard
        key={`fetch:${data.settings.fetchProvider ?? data.server.fetchProviders[0]}`}
        capability='fetch'
        data={data}
        save={save}
      />
      <Flex className='flex-between-wrap gap-3'>
        <Text type='secondary' fontSize={12} role='status'>
          {saving ? '正在保存…' : '按账号同步，未填写字段继承服务器配置。'}
        </Text>
        <Button disabled={saving} onClick={restore}>
          恢复服务器配置
        </Button>
      </Flex>
    </Flex>
  )
}
