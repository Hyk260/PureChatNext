'use client'


import { toast } from '@lobehub/ui'
import { ActionIcon, Block, Button, Flex, Github, Modal, Tag, Text } from '@pure/ui'
import { copyToClipboard } from '@pure/utils/client'
import { Segmented, Switch } from 'antd'
import { BadgeHelp, Bug, CheckCircle2, CircleX, Code2, Copy, FileText, Globe, MessageSquare, MessagesSquare, Rss, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import {
  SITE_DEFAULT_URL,
  SITE_DESCRIPTION,
  SITE_DISCUSSIONS_URL,
  SITE_DOCS_URL,
  SITE_ISSUES_URL,
  SITE_LANDING_URL,
  SITE_LICENSE_URL,
  SITE_NAME,
  SITE_RELEASES_URL,
  SITE_REPOSITORY_URL,
} from '@/const/site'
import { getDesktopApi } from '@/types/desktop'

import { UpdateLogo } from './UpdateLogo'
import { UpdateLogsModal } from './UpdateLogsModal'
import { UpdateSourceSettings } from './UpdateSourceSettings'
import { canShowInstallConfirmation, getUpdateButtonLabel } from './updatePresentation'
import { useDelayedLoading } from './useDelayedLoading'
import { useAboutUpdate } from './useAboutUpdate'

const RESOURCES = [
  { key: 'docs', icon: BadgeHelp, title: '帮助文档', href: SITE_DOCS_URL, action: '查看' },
  { key: 'releases', icon: Rss, title: '更新日志', href: SITE_RELEASES_URL, action: '查看' },
  { key: 'landing', icon: Globe, title: '产品介绍', href: SITE_LANDING_URL, action: '查看' },
  { key: 'website', icon: Globe, title: '官方网站', href: SITE_DEFAULT_URL, action: '查看' },
  { key: 'issues', icon: MessageSquare, title: '意见反馈', href: SITE_ISSUES_URL, action: '反馈' },
  { key: 'discussions', icon: MessagesSquare, title: '社区讨论', href: SITE_DISCUSSIONS_URL, action: '查看' },
]
const TEST_CHANNEL_OPTIONS = [
  { label: '预览版 (RC)', value: 'rc' },
  { label: '测试版 (Beta)', value: 'beta' },
]

function ResourceRow({
  icon: Icon,
  title,
  action,
  onAction,
}: {
  icon: LucideIcon
  title: string
  action: string
  onAction: () => void | Promise<void>
}) {
  return (
    <Flex className='flex-between gap-4 min-h-16 py-4'>
      <Flex className='items-center gap-3 min-w-0'>
        <Icon size={20} aria-hidden='true' className='shrink-0 text-muted-foreground' />
        <Text>{title}</Text>
      </Flex>
      <Button size='small' aria-label={`${action}${title}`} onClick={onAction}>
        {action}
      </Button>
    </Flex>
  )
}

export function AboutSettingsContent() {
  const update = useAboutUpdate()
  const [logsOpen, setLogsOpen] = useState(false)
  const progress = update.desktopState?.progress || 0
  const checking = update.status === 'checking'
  const showLoading = useDelayedLoading(checking || update.pending)
  const downloading = update.status === 'downloading'
  const installing = update.status === 'installing'
  const desktopLoading = update.isDesktop && !update.desktopState
  const disabled = update.pending || checking || downloading || installing || desktopLoading
  const preferencesDisabled = update.pending || installing || desktopLoading
  const cacheClearDisabled = update.pending || checking || downloading || installing
  const keepCacheButtonStable = !update.clearingCache && (update.pending || checking)
  const developmentCachePath = update.desktopState?.developmentCachePath
  const preferences = update.desktopState?.preferences
  const versionLabel = update.version ? `v${update.version}` : '版本读取中'
  const updateLabel = getUpdateButtonLabel(update.status, progress)
  const hasUpdate = canShowInstallConfirmation(update.status)
  const installationSupport = update.desktopState?.installationSupport || null
  const showTestPlan = installationSupport?.signature === 'development'
  const canInstall = update.status === 'ready' && installationSupport?.supported
  const feedbackIsError = update.status === 'error' || Boolean(update.loadError)
  const currentFeedback = update.feedback
    ? { message: update.feedback, isError: feedbackIsError, isUpToDate: update.status === 'upToDate' }
    : null
  const showDebugPanel = update.isDesktop

  const [settledFeedback, setSettledFeedback] = useState(() => ({
    status: update.status,
    feedback: currentFeedback,
  }))
  if (
    update.status !== 'checking' &&
    (settledFeedback.status !== update.status ||
      settledFeedback.feedback?.message !== currentFeedback?.message ||
      settledFeedback.feedback?.isError !== currentFeedback?.isError ||
      settledFeedback.feedback?.isUpToDate !== currentFeedback?.isUpToDate)
  ) {
    setSettledFeedback({ status: update.status, feedback: currentFeedback })
  }

  const displayedFeedback = update.status === 'checking' ? settledFeedback.feedback : currentFeedback
  const displayedFeedbackIcon = displayedFeedback?.isError
    ? CircleX
    : displayedFeedback?.isUpToDate
      ? CheckCircle2
      : TriangleAlert
  const displayedFeedbackColor = displayedFeedback?.isError
    ? 'text-red!'
    : displayedFeedback?.isUpToDate
      ? 'text-green!'
      : 'text-amber-600! dark:text-amber-400!'

  const openExternal = async (href: string) => {
    try {
      const api = getDesktopApi()
      if (api) await api.openExternal(href)
      else window.open(href, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error('无法打开链接，请稍后重试。')
    }
  }

  const handleUpdate = () => {
    if (hasUpdate) return update.confirmInstall()
    if (update.status === 'unsupported') return openExternal(SITE_RELEASES_URL)
    return update.check()
  }

  const handleCopyVersion = async () => {
    if (!update.version) return
    try {
      await copyToClipboard(`v${update.version}`)
      toast.success('已复制版本号')
    } catch {
      toast.error('复制失败，请手动复制版本号。')
    }
  }

  const openDebug = async () => {
    if (!update.isDesktop) return

    const api = getDesktopApi()
    if (api) {
      try {
        await api.openDevTools()
      } catch {
        toast.error('无法打开开发者工具，请通过桌面托盘重试。')
      }
      return
    }
  }

  const handleChannelChange = (value: string | number) => {
    if (value !== 'rc' && value !== 'beta') return
    update.savePreferences({ testChannel: value })
  }

  return (
    <Flex className='flex-col gap-6 w-full px-4 py-6 pb-16 sm:px-6'>
      {update.isDesktop ? (
        <UpdateLogsModal open={logsOpen} onClose={() => setLogsOpen(false)} installationSupport={installationSupport} />
      ) : null}
      <Modal
        open={update.installConfirmationOpen}
        title={`重启并安装 v${update.desktopState?.release?.version || ''}？`}
        okText='重启并安装'
        cancelText='稍后再说'
        confirmLoading={update.installing}
        okButtonProps={{ disabled: !canInstall || update.installing }}
        cancelButtonProps={{ disabled: update.installing }}
        closable={!update.installing}
        onCancel={update.closeInstallConfirmation}
        onOk={update.installUpdate}
      >
        应用将重启，进行中的聊天和工具任务会被中断。请先完成当前操作。
        {installationSupport && !installationSupport.supported ? (
          <Text as='p' className='mb-0 mt-3 text-amber-600! dark:text-amber-400!'>{installationSupport.message}</Text>
        ) : null}
      </Modal>
      <Block variant='outlined' className='rounded-2xl px-5 sm:px-6'>
        <Flex className='flex-between border-b border-app-border-secondary py-4'>
          <Text as='h2' className='m-0 text-base font-semibold'>
            关于我们
          </Text>
          <Button
            icon={<Github size={20} />}
            size='small'
            title='打开 GitHub 仓库'
            aria-label='打开 GitHub 仓库'
            onClick={() => openExternal(SITE_REPOSITORY_URL)}
          />
        </Flex>
        <Flex className='flex-between-wrap gap-5 py-6'>
          <Flex className='items-center gap-4 flex-1 min-w-0'>
            <UpdateLogo status={update.status} progress={progress} checking={showLoading} />
            <Flex className='flex-col items-start gap-2 min-w-0'>
              <Text as='h3' className='m-0 text-xl font-semibold'>
                {SITE_NAME}
              </Text>
              <Text className='text-[13px] leading-relaxed' type='secondary'>
                {SITE_DESCRIPTION}
              </Text>
              <Flex className='items-center gap-1'>
                <Tag color='green' size='small'>
                  {versionLabel}
                </Tag>
                <ActionIcon
                  icon={Copy}
                  size='small'
                  title='复制版本号'
                  disabled={!update.version}
                  onClick={handleCopyVersion}
                />
                {displayedFeedback ? (
                  <ActionIcon
                    aria-label={`${displayedFeedback.isError ? '更新错误' : '更新提示'}：${displayedFeedback.message}`}
                    className={displayedFeedbackColor}
                    icon={displayedFeedbackIcon}
                    size='small'
                    title={displayedFeedback.message}
                  />
                ) : null}
                {update.isDesktop ? (
                  <ActionIcon
                    aria-label='查看更新诊断日志'
                    icon={FileText}
                    size='small'
                    title='查看更新诊断日志'
                    onClick={() => setLogsOpen(true)}
                  />
                ) : null}
              </Flex>
            </Flex>
          </Flex>
          {update.isDesktop ? (
            <Button
              type={hasUpdate ? 'primary' : 'default'}
              loading={showLoading}
              disabled={disabled}
              onClick={handleUpdate}
            >
              {updateLabel}
            </Button>
          ) : null}
        </Flex>
        {update.isDesktop && update.desktopState ? (
          <UpdateSourceSettings
            key={JSON.stringify([preferences?.updateSource, preferences?.customUpdateUrl, update.desktopState.effectiveSource])}
            preferences={update.desktopState.preferences}
            source={update.desktopState.effectiveSource}
            disabled={preferencesDisabled}
            onSave={update.savePreferences}
          />
        ) : null}
        {update.isDesktop ? (
          <Flex className='flex-between gap-4 border-t border-app-border-secondary py-4'>
            <Flex className='flex-col gap-1'>
              <Text>自动更新</Text>
              <Text className='text-xs' type='secondary'>
                后台检测并下载，安装前由你确认
              </Text>
            </Flex>
            <Switch
              key={desktopLoading ? 'loading' : 'ready'}
              aria-label='自动更新'
              className={desktopLoading ? 'invisible' : undefined}
              checked={update.autoUpdate}
              disabled={preferencesDisabled}
              onChange={update.setAutoUpdate}
            />
          </Flex>
        ) : null}
        {showTestPlan ? (
          <Flex className='flex-between-wrap gap-4 border-t border-app-border-secondary py-4'>
            <Flex className='flex-col gap-1'>
              <Flex className='items-center gap-1.5'>
                <Text>测试计划</Text>
                <Code2
                  aria-label='开发环境'
                  className='size-4 text-amber-600 dark:text-amber-400'
                  role='img'
                />
              </Flex>
              <Text className='text-xs' type='secondary'>
                提前体验新功能，测试版本可能不稳定
              </Text>
            </Flex>
            <Flex className='items-center flex-wrap gap-3'>
              {preferences?.testPlan ? (
                <Segmented
                  options={TEST_CHANNEL_OPTIONS}
                  value={preferences.testChannel}
                  disabled={preferencesDisabled}
                  onChange={handleChannelChange}
                />
              ) : null}
              <Switch
                key={desktopLoading ? 'loading' : 'ready'}
                aria-label='测试计划'
                className={desktopLoading ? 'invisible' : undefined}
                checked={preferences?.testPlan || false}
                disabled={preferencesDisabled}
                onChange={(testPlan) => update.savePreferences({ testPlan })}
              />
            </Flex>
            {preferences?.testPlan ? (
              <Text className='w-full text-xs' type='secondary'>
                返回稳定渠道不会自动降级，可能需要等待更高的稳定版本。
              </Text>
            ) : null}
          </Flex>
        ) : null}
        {developmentCachePath ? (
          <Flex className='flex-between-wrap gap-4 border-t border-app-border-secondary py-4'>
            <Flex className='flex-col gap-1 min-w-0 flex-1'>
              <Flex className='items-center gap-1.5'>
                <Text>清理下载安装包缓存</Text>
                <Code2
                  aria-label='开发环境'
                  className='size-4 text-amber-600 dark:text-amber-400'
                  role='img'
                />
              </Flex>
              <Text className='text-xs' type='secondary'>
                仅开发环境使用，清理后可重新检查更新测试下载
              </Text>
              <Text className='break-all font-mono text-xs select-text' type='secondary'>
                缓存路径：{developmentCachePath}
              </Text>
            </Flex>
            <Button
              className={keepCacheButtonStable ? 'disabled:opacity-100!' : undefined}
              loading={update.clearingCache}
              disabled={cacheClearDisabled}
              onClick={update.clearCache}
            >
              清理缓存
            </Button>
          </Flex>
        ) : null}
      </Block>

      {update.desktopState?.release ? (
        <Block variant='outlined' className='rounded-2xl p-5 sm:p-6'>
          <Text as='h2' className='m-0 mb-3 text-base font-semibold'>
            新版本 v{update.desktopState.release.version}
          </Text>
          <Text as='p' className='m-0 max-h-64 overflow-auto whitespace-pre-wrap text-sm' type='secondary'>
            {update.desktopState.release.notes || '此版本暂未提供更新说明，可前往更新日志查看。'}
          </Text>
        </Block>
      ) : null}

      <Block variant='outlined' className='rounded-2xl px-5 sm:px-6'>
        <Flex className='flex-col divide-y divide-app-border-secondary'>
          {RESOURCES.map((resource) => (
            <ResourceRow
              key={resource.key}
              icon={resource.icon}
              title={resource.title}
              action={resource.action}
              onAction={() => openExternal(resource.href)}
            />
          ))}
          {showDebugPanel ? <ResourceRow icon={Bug} title='调试面板' action='打开' onAction={openDebug} /> : null}
        </Flex>
      </Block>

      <Flex className='flex-col items-center gap-3 text-center'>
        <Text className='text-xs' type='secondary'>
          {SITE_NAME} 是开源项目，源码按 MIT License 发布。
        </Text>
        <Flex className='flex-center flex-wrap gap-4 text-xs'>
          <Button size='small' onClick={() => openExternal(SITE_LICENSE_URL)}>
            开源协议
          </Button>
          <Link to='/help' className='text-inherit'>
            帮助与支持
          </Link>
          <Link to='/privacy' className='text-inherit'>
            隐私政策
          </Link>
          <Link to='/terms' className='text-inherit'>
            服务条款
          </Link>
        </Flex>
      </Flex>
    </Flex>
  )
}
