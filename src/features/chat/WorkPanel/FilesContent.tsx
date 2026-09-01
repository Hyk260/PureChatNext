'use client'

import { ActionIcon, Icon, Input, Text, Flex } from '@pure/ui'
import { File, FileText, Folder, FolderOpen, Search } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
import type { LocalChatTopic } from '@/features/chat/types'
import { getDesktopApi } from '@/types/desktop'
import type { DesktopProject, DesktopProjectEntry } from '@/types/desktop'

type Props = {
  topic: LocalChatTopic | null
}

function joinRelative(parent: string, name: string) {
  return parent ? `${parent}/${name}` : name
}

function parentRelative(relativePath: string) {
  const parts = relativePath.split('/').filter(Boolean)
  parts.pop()
  return parts.join('/')
}

function joinProjectPath(rootPath: string, relativePath: string, name: string) {
  const separator = rootPath.includes('\\') ? '\\' : '/'
  const segments = [rootPath, ...relativePath.split(/[/\\]/).filter(Boolean), name]
  return segments.join(separator)
}

const FilesContent = memo<Props>(({ topic }) => {
  const { message } = useApp()
  const [project, setProject] = useState<DesktopProject | null>(null)
  const [relativePath, setRelativePath] = useState('')
  const [entries, setEntries] = useState<DesktopProjectEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loadEntries = useCallback(
    async (nextProject: DesktopProject | null, nextRelativePath: string) => {
      const api = getDesktopApi()
      if (!api?.listProjectEntries || !nextProject) {
        setEntries([])
        setError(null)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const result = await api.listProjectEntries({
          projectId: nextProject.id,
          relativePath: nextRelativePath || undefined,
        })
        setEntries(result.entries)
      } catch (loadError) {
        setEntries([])
        setError(loadError instanceof Error ? loadError.message : '读取文件失败')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    let cancelled = false
    const api = getDesktopApi()

    const syncProject = async () => {
      if (!api?.listProjects || !topic?.projectName) {
        if (!cancelled) {
          setProject(null)
          setRelativePath('')
          setEntries([])
          setError(null)
        }
        return
      }

      try {
        const projects = await api.listProjects()
        if (cancelled) return
        const matched = projects.find((item) => item.name === topic.projectName) ?? null
        setProject(matched)
        setRelativePath('')
        await loadEntries(matched, '')
      } catch (loadError) {
        if (cancelled) return
        setProject(null)
        setEntries([])
        setError(loadError instanceof Error ? loadError.message : '加载项目失败')
      }
    }

    void syncProject()
    return () => {
      cancelled = true
    }
  }, [loadEntries, topic?.projectName])

  const filteredEntries = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return entries
    return entries.filter((entry) => entry.name.toLowerCase().includes(query))
  }, [entries, filter])

  const handleOpenEntry = useCallback(
    async (entry: DesktopProjectEntry) => {
      if (entry.isDirectory) {
        const nextPath = joinRelative(relativePath, entry.name)
        setRelativePath(nextPath)
        await loadEntries(project, nextPath)
        return
      }

      const api = getDesktopApi()
      if (!api?.openPath || !project) return
      const fullPath = joinProjectPath(project.rootPath, relativePath, entry.name)
      try {
        await api.openPath(fullPath)
      } catch (openError) {
        message.error(openError instanceof Error ? openError.message : '打开文件失败')
      }
    },
    [loadEntries, message, project, relativePath]
  )

  const handleGoUp = useCallback(async () => {
    const nextPath = parentRelative(relativePath)
    setRelativePath(nextPath)
    await loadEntries(project, nextPath)
  }, [loadEntries, project, relativePath])

  if (!getDesktopApi()?.listProjectEntries) {
    return (
      <EmptyState
        description='文件列表仅在桌面端可用'
        icon={FileText}
      />
    )
  }

  if (!topic?.projectName || !project) {
    return <EmptyState description='此工作区中没有文件' icon={File} />
  }

  return (
    <Flex className='flex-col h-full min-h-0'>
      <Flex className='flex-col gap-2 p-3 flex-none border-b border-(--ant-color-border-secondary)'>
        <Input
          allowClear
          placeholder='筛选文件...'
          prefix={<Icon icon={Search} size={14} />}
          size='small'
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <Flex className='flex-row items-center gap-1 min-w-0'>
          {relativePath ? (
            <ActionIcon icon={FolderOpen} size='small' title='返回上级' onClick={() => void handleGoUp()} />
          ) : null}
          <Text ellipsis type='secondary'>
            {relativePath || project.name}
          </Text>
        </Flex>
      </Flex>

      <Flex className='flex-col min-h-0 overflow-auto flex-1'>
        {loading ? (
          <Text className='p-4' type='secondary'>
            加载中...
          </Text>
        ) : error ? (
          <Text className='p-4' type='danger'>
            {error}
          </Text>
        ) : filteredEntries.length === 0 ? (
          <EmptyState description={filter.trim() ? '没有匹配的文件' : '此工作区中没有文件'} icon={File} />
        ) : (
          filteredEntries.map((entry) => (
            <button
              className='flex items-center gap-2 w-full px-3 py-2 text-left border-0 bg-transparent cursor-pointer hover:bg-(--ant-color-fill-quaternary)'
              key={`${entry.isDirectory ? 'dir' : 'file'}:${entry.name}`}
              type='button'
              onClick={() => void handleOpenEntry(entry)}
            >
              <Icon icon={entry.isDirectory ? Folder : FileText} size={16} />
              <Text ellipsis>{entry.name}</Text>
            </button>
          ))
        )}
      </Flex>
    </Flex>
  )
})

FilesContent.displayName = 'FilesContent'

function EmptyState({ description, icon }: { description: string; icon: typeof File }) {
  return (
    <Flex className='flex-col items-center justify-center gap-3 flex-1 min-h-[240px] p-6'>
      <Icon icon={icon} size={36} style={{ color: 'var(--ant-color-text-quaternary)' }} />
      <Text type='secondary'>{description}</Text>
    </Flex>
  )
}

export default FilesContent
