'use client'

import { getErrorMessage } from '@pure/utils/error'

import {
  ActionIcon,
  Button,
  DropdownMenu,
  Flexbox as Flex,
  FocusScope,
  Icon,
  Image,
  MaterialFileTypeIcon,
  Text,
  createStaticStyles,
  cssVar,
  toast,
} from '@lobehub/ui'
import { ChevronRight, ExternalLink, MoreHorizontal, RefreshCw, X } from 'lucide-react'
import { memo, useEffect, useState } from 'react'
import type { Dispatch, KeyboardEvent } from 'react'

import { getDesktopApi } from '@/types/desktop'
import type { DesktopProject, DesktopProjectFile } from '@/types/desktop'

import CodePreview from './CodePreview'
import { FileEmptyState } from './FilesContent'
import { getProjectFilePath } from './previewUtils'
import type { FileTabsAction, FileTabsState } from './previewUtils'
import { useHorizontalWheel } from './useHorizontalWheel'

// 选中和悬停组合使用组件主题色，避免与按钮自身的悬停样式互相覆盖。
const styles = createStaticStyles(({ css }) => ({
  tab: css`
    display: flex;
    flex: none;
    align-items: center;
    gap: 2px;
    height: 28px;
    padding-inline-end: 4px;
    border: 1px solid transparent;
    border-radius: 6px;
    color: ${cssVar.colorTextSecondary};
    background: transparent;
    transition:
      background 0.15s ${cssVar.motionEaseInOut},
      color 0.15s ${cssVar.motionEaseInOut};
    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
    &[data-active='true'] {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
    }
  `,
  tabClose: css`
    cursor: pointer;

    display: grid;
    flex: none;
    place-items: center;

    width: 16px;
    height: 16px;
    padding: 0;
    border: 0;
    border-radius: 3px;

    color: inherit;
    background: transparent;
    opacity: 0.6;

    transition:
      background 0.15s ${cssVar.motionEaseInOut},
      opacity 0.15s ${cssVar.motionEaseInOut};

    &:hover {
      background: ${cssVar.colorFillSecondary};
      opacity: 1;
    }
  `,
}))

async function openInSystem(project: DesktopProject, path: string) {
  try {
    await getDesktopApi()?.openPath(getProjectFilePath(project.rootPath, path))
  } catch (error) {
    toast.error(getErrorMessage(error, '打开文件失败'))
  }
}

const FilePreviewBody = memo(({ project, path }: { project: DesktopProject; path: string }) => {
  const [file, setFile] = useState<DesktopProjectFile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const read = async () => {
      const api = getDesktopApi()
      if (!api?.readProjectFile) {
        setError('请更新桌面客户端后使用文件预览')
        return
      }
      try {
        const result = await api.readProjectFile({ projectId: project.id, relativePath: path })
        if (!cancelled) setFile(result)
      } catch (readError) {
        if (!cancelled) setError(getErrorMessage(readError, '读取文件失败'))
      }
    }
    read()
    return () => {
      cancelled = true
    }
  }, [path, project.id])

  if (error) return <FileEmptyState description={error} />
  if (!file) return <FileEmptyState description='正在读取文件...' />
  if (file.kind === 'text') return <CodePreview content={file.content} filePath={path} />
  if (file.kind === 'image') {
    return (
      <Flex horizontal align='center' className='size-full overflow-auto p-4' justify='center'>
        <Image alt={file.name} className='max-h-full max-w-full object-contain' preview={false} src={file.dataUrl} />
      </Flex>
    )
  }
  return (
    <Flex className='size-full' direction='vertical'>
      <FileEmptyState description={file.reason} />
      <Button className='mx-auto mb-6' icon={ExternalLink} onClick={() => openInSystem(project, path)}>
        在系统中打开
      </Button>
    </Flex>
  )
})

FilePreviewBody.displayName = 'FilePreviewBody'

type Props = {
  dispatch: Dispatch<FileTabsAction>
  project: DesktopProject
  tabs: FileTabsState
}

const FilePreview = memo<Props>(({ dispatch, project, tabs }) => {
  const [revisions, setRevisions] = useState<Record<string, number>>({})
  const tabListRef = useHorizontalWheel<HTMLDivElement>()
  const breadcrumbRef = useHorizontalWheel<HTMLElement>()
  const activePath = tabs.activePath

  useEffect(() => {
    tabListRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activePath, tabListRef])

  if (!activePath) return null
  const pathParts = activePath.split('/')

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.paths.indexOf(activePath)
    let nextIndex = index
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.paths.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.paths.length) % tabs.paths.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = tabs.paths.length - 1
    else return
    event.preventDefault()
    const next = tabs.paths[nextIndex]
    if (!next) return
    dispatch({ type: 'open', path: next })
    tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus()
  }

  return (
    <FocusScope
      aria-label='文件内容预览'
      className='flex h-full min-w-0 flex-1 flex-col border-s border-app-border-secondary'
    >
      <Flex horizontal align='center' className='h-10 shrink-0 gap-1 border-b border-app-border-secondary px-2'>
        <div
          aria-label='已打开文件'
          className='no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto'
          onKeyDown={handleTabKeyDown}
          ref={tabListRef}
          role='tablist'
        >
          {tabs.paths.map((path) => {
            const name = path.split('/').at(-1) ?? path
            const active = path === activePath
            return (
              <Flex horizontal align='center' className={styles.tab} data-active={active} key={path}>
                <button
                  aria-controls={`file-preview-${encodeURIComponent(path)}`}
                  aria-selected={active}
                  className='flex h-7 max-w-48 items-center gap-1.5 border-0 bg-transparent ps-2 text-[13px] text-inherit'
                  onClick={() => dispatch({ type: 'open', path })}
                  role='tab'
                  tabIndex={active ? 0 : -1}
                  title={path}
                  type='button'
                >
                  <MaterialFileTypeIcon aria-hidden fallbackUnknownType={false} filename={name} size={14} type='file' />
                  <span className='truncate'>{name}</span>
                </button>
                <button
                  aria-label={`关闭 ${name}`}
                  className={styles.tabClose}
                  title={`关闭 ${name}`}
                  type='button'
                  onClick={() => dispatch({ type: 'close', path })}
                >
                  <X aria-hidden='true' size={12} strokeWidth={2} />
                </button>
              </Flex>
            )
          })}
        </div>
        <DropdownMenu
          items={[
            { key: 'others', label: '关闭其他文件', onClick: () => dispatch({ type: 'closeOthers' }) },
            { key: 'all', label: '关闭所有文件', onClick: () => dispatch({ type: 'closeAll' }) },
          ]}
        >
          <ActionIcon aria-label='预览更多操作' icon={MoreHorizontal} size='small' title='预览更多操作' />
        </DropdownMenu>
        <ActionIcon
          aria-label='关闭文件预览'
          icon={X}
          size='small'
          title='关闭文件预览'
          onClick={() => dispatch({ type: 'closeAll' })}
        />
      </Flex>
      <Flex horizontal align='center' className='h-10 shrink-0 gap-1 border-b border-app-border-secondary px-3 py-1.5'>
        <nav
          aria-label='文件路径'
          className='flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-xs'
          ref={breadcrumbRef}
        >
          <Text className='shrink-0' fontSize={12} type='secondary'>
            {project.name}
          </Text>
          {pathParts.map((part, index) => (
            <Flex horizontal align='center' className='shrink-0 gap-1' key={pathParts.slice(0, index + 1).join('/')}>
              <Icon icon={ChevronRight} size={12} />
              <Text fontSize={12} type={index === pathParts.length - 1 ? undefined : 'secondary'}>
                {part}
              </Text>
            </Flex>
          ))}
        </nav>
        <ActionIcon
          aria-label='重新读取文件'
          icon={RefreshCw}
          size='small'
          title='重新读取文件'
          onClick={() => setRevisions((current) => ({ ...current, [activePath]: (current[activePath] ?? 0) + 1 }))}
        />
        <ActionIcon
          aria-label='在系统中打开文件'
          icon={ExternalLink}
          size='small'
          title='在系统中打开文件'
          onClick={() => openInSystem(project, activePath)}
        />
      </Flex>
      {tabs.paths.map((path) => (
        <div
          className='min-h-0 flex-1 overflow-hidden'
          hidden={path !== activePath}
          id={`file-preview-${encodeURIComponent(path)}`}
          key={`${path}:${revisions[path] ?? 0}`}
          role='tabpanel'
        >
          <FilePreviewBody path={path} project={project} />
        </div>
      ))}
    </FocusScope>
  )
})

FilePreview.displayName = 'FilePreview'

export default FilePreview
