import { Button, Flex, Modal, Text } from '@pure/ui'
import useSWR from 'swr'

import { getDesktopApi } from '@/types/desktop'
import type { DesktopUpdateInstallationSupport } from '@/types/desktopUpdater'

export function UpdateLogsModal({ open, onClose, installationSupport }: {
  open: boolean
  onClose: () => void
  installationSupport: DesktopUpdateInstallationSupport | null
}) {
  const api = getDesktopApi()
  const { data: logs, error, isValidating: loading, mutate } = useSWR(
    open && api ? 'desktop:update:logs' : null,
    () => {
      if (!api) throw new Error('桌面 API 不可用')
      return api.updater.getLogs()
    },
    { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false }
  )

  return (
    <Modal
      open={open}
      title='桌面更新日志'
      width={880}
      onCancel={onClose}
      footer={(
        <Flex className='justify-end gap-2'>
          <Button loading={loading} onClick={() => mutate().catch(() => undefined)}>刷新</Button>
          <Button onClick={onClose}>关闭</Button>
        </Flex>
      )}
    >
      <Flex className='flex-col gap-3'>
        <Text className={installationSupport?.supported ? 'text-green!' : 'text-amber-600! dark:text-amber-400!'}>
          {installationSupport?.message || '正在检查当前应用的安装条件…'}
        </Text>
        <Text className='text-xs' type='secondary'>
          仅显示 desktop:update 日志及对应错误堆栈{logs?.truncated ? '，较早的日志已省略' : ''}。
        </Text>
        {error ? (
          <Text role='alert' className='text-red'>无法读取更新日志，请刷新重试或通过帮助菜单打开日志目录。</Text>
        ) : null}
        <pre
          aria-label='desktop:update 日志'
          aria-busy={loading}
          className='m-0 max-h-[55vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-secondary p-3 text-xs'
        >
          {logs?.text || (loading ? '正在读取日志…' : '暂无 desktop:update 日志。')}
        </pre>
      </Flex>
    </Modal>
  )
}
