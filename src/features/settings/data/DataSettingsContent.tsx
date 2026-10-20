import { toast } from '@lobehub/ui'
import { ActionIcon, Block, Button, Flex, Modal, Select, Skeleton, Text } from '@pure/ui'
import { copyToClipboard } from '@pure/utils/client'
import { Alert } from 'antd'
import { Copy, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { DesktopDataDirectory, DesktopDataInfo, DesktopLogRetentionDays } from '@/types/desktop'
import { getDesktopApi } from '@/types/desktop'

const RETENTION_OPTIONS: { label: string; value: DesktopLogRetentionDays }[] = [
  { label: '7 天', value: 7 },
  { label: '14 天', value: 14 },
  { label: '30 天', value: 30 },
  { label: '90 天', value: 90 },
  { label: '永久保留', value: 0 },
]

function isDesktopLogRetentionDays(value: unknown): value is DesktopLogRetentionDays {
  return RETENTION_OPTIONS.some((option) => option.value === value)
}

function cacheLabel(bytes: number | null): string {
  if (bytes === null) return '统计失败'
  return `约 ${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function DirectoryRow({
  label,
  directory,
  path,
  onError,
}: {
  label: string
  directory: DesktopDataDirectory
  path: string
  onError: (text: string) => void
}) {
  const open = async () => {
    try {
      await getDesktopApi()?.openDataDirectory(directory)
    } catch {
      onError(`无法打开${label}目录，请重试`)
    }
  }
  const copy = async () => {
    try {
      await copyToClipboard(path)
    } catch {
      onError('复制路径失败，请重试')
    }
  }
  return (
    <Flex className='flex-wrap items-center gap-3 border-b border-border py-4'>
      <Text className='shrink-0'>{label}</Text>
      <Flex className='min-w-0 flex-1 items-center justify-end gap-2'>
        <Text className='min-w-0 break-all text-right text-sm' title={path} type='secondary'>
          {path}
        </Text>
        <ActionIcon
          icon={Copy}
          size='small'
          title={`复制${label}路径`}
          aria-label={`复制${label}路径`}
          onClick={copy}
        />
      </Flex>
      <Button onClick={open}>{directory === 'data' ? '打开目录' : '打开日志'}</Button>
    </Flex>
  )
}

export function DataSettingsContent() {
  const api = getDesktopApi()
  const [data, setData] = useState<DesktopDataInfo | null>(null)
  const [loading, setLoading] = useState(Boolean(api))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [clearCacheConfirmOpen, setClearCacheConfirmOpen] = useState(false)
  const operation = useRef(false)
  const generation = useRef(0)
  const confirming = useRef(false)

  const load = useCallback(async () => {
    const desktop = getDesktopApi()
    if (!desktop) return
    const current = ++generation.current
    setLoading(true)
    setError(null)
    try {
      const result = await desktop.getDataInfo()
      if (current === generation.current) setData(result)
    } catch {
      if (current === generation.current) setError('无法加载数据目录信息，请重试')
    } finally {
      if (current === generation.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const desktop = getDesktopApi()
    if (!desktop) return
    let cancelled = false
    const current = ++generation.current
    desktop
      .getDataInfo()
      .then((result) => {
        if (!cancelled && current === generation.current) {
          setData(result)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled && current === generation.current) {
          setError('无法加载数据目录信息，请重试')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setRetention = async (days: DesktopLogRetentionDays) => {
    if (!api || operation.current) return
    operation.current = true
    setBusy(true)
    setError(null)
    try {
      await api.setLogRetentionDays(days)
      setData((current) => (current ? { ...current, logRetentionDays: days } : current))
      toast.success('日志保留期已保存')
    } catch {
      setError('保存日志保留期失败，请重新选择以重试')
    } finally {
      operation.current = false
      setBusy(false)
    }
  }

  const handleRetentionChange = async (value: unknown) => {
    if (isDesktopLogRetentionDays(value)) await setRetention(value)
  }

  const clearCache = () => {
    if (!api || operation.current || confirming.current) return
    confirming.current = true
    setClearCacheConfirmOpen(true)
  }

  const confirmClearCache = async () => {
    if (!api || operation.current) return
    operation.current = true
    setBusy(true)
    setError(null)
    try {
      await api.clearHttpCache()
      toast.success('缓存已清除')
      await load()
    } catch {
      setError('清除缓存失败，请重试')
    } finally {
      confirming.current = false
      operation.current = false
      setBusy(false)
      setClearCacheConfirmOpen(false)
    }
  }

  const cancelClearCache = () => {
    if (busy) return
    confirming.current = false
    setClearCacheConfirmOpen(false)
  }

  if (!api)
    return (
      <Flex className='w-full flex-col gap-6 px-6 py-6'>
        <Block padding={16} variant='filled'>
          <Text type='secondary'>数据管理仅在桌面端可用。</Text>
        </Block>
      </Flex>
    )

  return (
    <Flex className='w-full flex-col gap-6 px-6 py-6 pb-16'>
      <Modal
        open={clearCacheConfirmOpen}
        title='清除缓存'
        okText='清除缓存'
        cancelText='取消'
        confirmLoading={busy}
        onCancel={cancelClearCache}
        onOk={confirmClearCache}
      >
        仅清除桌面 HTTP 缓存，资源可能需要重新下载。登录状态、聊天数据和项目文件将保留。
      </Modal>
      {error ? (
        <Alert
          type='error'
          showIcon
          message={error}
          action={
            <Button disabled={busy} onClick={load}>
              重试
            </Button>
          }
        />
      ) : null}
      {loading && !data ? <Skeleton.Text rows={7} /> : null}
      {data ? (
        <Block padding={24} variant='filled'>
          <Text className='mb-2 block text-base font-semibold'>数据目录</Text>
          <DirectoryRow label='应用数据' directory='data' path={data.dataPath} onError={setError} />
          <DirectoryRow label='应用日志' directory='logs' path={data.logsPath} onError={setError} />
          <Flex className='flex-col gap-3 border-b border-border py-4'>
            <Flex className='flex-between gap-4'>
              <label className='flex items-center' htmlFor='log-retention-days'>
                <Text>日志保留期</Text>
              </label>
              <Select
                id='log-retention-days'
                className='w-40'
                options={RETENTION_OPTIONS}
                value={data.logRetentionDays}
                disabled={busy || loading}
                onChange={handleRetentionChange}
              />
            </Flex>
            <Text type='secondary' className='text-sm'>
              超过保留期的日志会自动删除：启动时检查一次，之后每 12 小时检查一次。
            </Text>
          </Flex>
          <Flex className='flex-between-wrap gap-3 pt-4'>
            <Flex className='items-center gap-2'>
              <Text>清除缓存</Text>
              <Text type='secondary'>（{cacheLabel(data.cacheBytes)}）</Text>
              <ActionIcon
                icon={RefreshCw}
                title='重新统计缓存'
                aria-label='重新统计缓存'
                size='small'
                disabled={busy || loading}
                onClick={load}
              />
            </Flex>
            <Button loading={busy} disabled={loading} onClick={clearCache}>
              清除缓存
            </Button>
          </Flex>
        </Block>
      ) : null}
    </Flex>
  )
}
