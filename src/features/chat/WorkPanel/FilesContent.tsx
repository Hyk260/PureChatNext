'use client'

import { getErrorMessage } from '@pure/utils/error'

import {
  ActionIcon,
  DropdownMenu,
  Flexbox as Flex,
  Icon,
  Input,
  MaterialFileTypeIcon,
  Text,
  Tree,
  toast,
} from '@lobehub/ui'
import type { TreeDataNode } from '@lobehub/ui'
import {
  Copy,
  FileText,
  FolderOpen,
  FolderTree,
  FoldVertical,
  MoreHorizontal,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getDesktopApi } from '@/types/desktop'
import type { DesktopProject, DesktopProjectEntry } from '@/types/desktop'

type DirectoryState = { entries?: DesktopProjectEntry[]; error?: string }
type DirectoryCache = Record<string, DirectoryState>
const ROOT_KEY = '/'

async function readDirectory(projectId: string, relativePath: string): Promise<DirectoryState> {
  try {
    const result = await getDesktopApi()!.listProjectEntries({ projectId, relativePath })
    return { entries: result.entries }
  } catch (error) {
    return { error: getErrorMessage(error, '读取文件夹失败') }
  }
}

type Props = {
  activePath: string | null
  error: string | null
  loading: boolean
  onOpenFile: (path: string) => void
  project: DesktopProject | null
}

function buildProjectTree(
  project: DesktopProject,
  directories: DirectoryCache,
  expanded: Set<string>,
  query: string
): TreeDataNode[] {
  const buildDirectory = (name: string, relativePath: string, parentMatches = false): TreeDataNode | null => {
    const key = relativePath || ROOT_KEY
    const directory = directories[relativePath]
    const matches = parentMatches || name.toLowerCase().includes(query)
    const children: TreeDataNode[] = []
    for (const entry of directory?.entries ?? []) {
      const path = relativePath ? `${relativePath}/${entry.name}` : entry.name
      if (entry.isDirectory) {
        const child = buildDirectory(entry.name, path, matches)
        if (child) children.push(child)
      } else if (!query || matches || entry.name.toLowerCase().includes(query)) {
        children.push({
          icon: (
            <MaterialFileTypeIcon aria-hidden fallbackUnknownType={false} filename={entry.name} size={16} type='file' />
          ),
          isLeaf: true,
          key: path,
          title: (
            <Text className='block truncate' fontSize={12} title={path}>
              {entry.name}
            </Text>
          ),
        })
      }
    }
    if (query && !matches && children.length === 0 && relativePath) return null
    if (!children.length && (!query || matches)) {
      let label = '展开文件夹以加载内容'
      if (directory?.error) label = `${directory.error}（收起后展开重试）`
      else if (directory?.entries) label = '此文件夹为空'
      children.push({ disabled: true, isLeaf: true, key: `${key}//status`, title: label })
    }
    return {
      children,
      icon: (
        <MaterialFileTypeIcon
          aria-hidden
          fallbackUnknownType={false}
          filename={name}
          open={expanded.has(key) || Boolean(query)}
          size={18}
          type='folder'
        />
      ),
      key,
      title: (
        <Text className='block truncate' fontSize={12} title={relativePath || project.rootPath}>
          {name}
        </Text>
      ),
    }
  }
  const root = buildDirectory(project.name, '')
  if (!root || (query && !root.children?.length)) return []
  return [root]
}

function collectDirectoryKeys(nodes: TreeDataNode[]): string[] {
  return nodes.flatMap((node) => (node.isLeaf ? [] : [node.key, ...collectDirectoryKeys(node.children ?? [])]))
}

const FilesContent = memo<Props>(({ activePath, error, loading, onOpenFile, project }) => {
  const [directories, setDirectories] = useState<DirectoryCache>({})
  const [expandedKeys, setExpandedKeys] = useState<string[]>([ROOT_KEY])
  const [filter, setFilter] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const requestsRef = useRef({ pending: new Set<string>(), generation: 0 })

  const loadDirectory = useCallback(
    async (relativePath: string) => {
      const api = getDesktopApi()
      const requests = requestsRef.current
      if (!api?.listProjectEntries || !project || requests.pending.has(relativePath)) return
      const generation = requests.generation
      requests.pending.add(relativePath)
      try {
        const directory = await readDirectory(project.id, relativePath)
        if (generation !== requests.generation) return
        setDirectories((current) => ({ ...current, [relativePath]: directory }))
      } finally {
        if (generation === requests.generation) requests.pending.delete(relativePath)
      }
    },
    [project]
  )

  useEffect(() => {
    if (!project || !getDesktopApi()?.listProjectEntries) return
    const requests = requestsRef.current
    const generation = requests.generation
    requests.pending.add('')
    readDirectory(project.id, '').then((directory) => {
      if (generation !== requests.generation) return
      setDirectories((current) => ({ ...current, '': directory }))
      requests.pending.delete('')
    })
    return () => {
      requests.generation++
      requests.pending.clear()
    }
  }, [project])

  const handleRefresh = useCallback(() => {
    requestsRef.current.generation++
    requestsRef.current.pending.clear()
    setDirectories({})
    setExpandedKeys([ROOT_KEY])
    loadDirectory('')
  }, [loadDirectory])

  const query = filter.trim().toLowerCase()
  const nodes = useMemo(
    () => (project ? buildProjectTree(project, directories, new Set(expandedKeys), query) : []),
    [directories, expandedKeys, project, query]
  )
  const visibleExpandedKeys = query ? collectDirectoryKeys(nodes) : expandedKeys

  const handleExpand = (keys: string[]) => {
    setExpandedKeys(keys)
    for (const key of keys) {
      const path = key === ROOT_KEY ? '' : key
      if (!directories[path]?.entries) loadDirectory(path)
    }
  }

  const handleCollapseAll = () => {
    setFilter('')
    setExpandedKeys([])
  }

  const handleSelect = (_keys: string[], { node }: { node: TreeDataNode }) => {
    if (node.isLeaf) {
      onOpenFile(node.key)
      return
    }
    const keys = expandedKeys.includes(node.key)
      ? expandedKeys.filter((key) => key !== node.key)
      : [...expandedKeys, node.key]
    handleExpand(keys)
  }

  const handleOpenProject = async () => {
    if (!project) return
    try {
      await getDesktopApi()?.openPath(project.rootPath)
    } catch (openError) {
      toast.error(getErrorMessage(openError, '打开项目失败'))
    }
  }

  const handleCopyPath = async () => {
    if (!project) return
    try {
      await navigator.clipboard.writeText(project.rootPath)
      toast.success('已复制项目路径')
    } catch {
      toast.error('复制路径失败')
    }
  }

  if (!getDesktopApi()?.listProjectEntries) return <FileEmptyState description='文件列表仅在桌面端可用' />
  if (loading) return <FileEmptyState description='正在加载项目...' />
  if (error) return <FileEmptyState description={error} />
  if (!project) return <FileEmptyState description='此工作区中没有文件' />

  return (
    <Flex className='h-full min-h-0' direction='vertical'>
      <Flex horizontal align='center' className='shrink-0 px-2 py-2' gap={4}>
        {searchOpen ? (
          <Input
            aria-label='筛选文件'
            autoFocus
            className='min-w-0 flex-1'
            placeholder='筛选已加载的文件...'
            prefix={<Icon icon={Search} size={14} />}
            size='small'
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        ) : (
          <Flex horizontal align='center' className='min-w-0 flex-1 px-1' gap={6}>
            <Icon icon={FolderTree} size={16} />
            <Text fontSize={13} weight={500}>
              项目
            </Text>
          </Flex>
        )}
        <ActionIcon
          aria-label={searchOpen ? '关闭筛选' : '筛选文件'}
          icon={searchOpen ? X : Search}
          size='small'
          title={searchOpen ? '关闭筛选' : '筛选文件'}
          onClick={() => {
            setSearchOpen(!searchOpen)
            setFilter('')
          }}
        />
        <ActionIcon
          aria-label='全部收起'
          icon={FoldVertical}
          size='small'
          title='全部收起'
          onClick={handleCollapseAll}
        />
        <DropdownMenu
          items={[
            { icon: <Icon icon={RefreshCw} />, key: 'refresh', label: '刷新文件列表', onClick: handleRefresh },
            { icon: <Icon icon={FolderOpen} />, key: 'open', label: '在系统中打开项目', onClick: handleOpenProject },
            { icon: <Icon icon={Copy} />, key: 'copy', label: '复制项目路径', onClick: handleCopyPath },
          ]}
        >
          <ActionIcon aria-label='文件更多操作' icon={MoreHorizontal} size='small' title='文件更多操作' />
        </DropdownMenu>
      </Flex>
      <div aria-label='项目文件' className='min-h-0 flex-1 overflow-auto px-1 pb-2'>
        {nodes.length ? (
          <Tree
            blockNode
            expandedKeys={visibleExpandedKeys}
            selectedKeys={activePath ? [activePath] : []}
            showIcon
            showLine
            styles={{ node: { height: 30 }, title: { minWidth: 0 } }}
            treeData={nodes}
            onExpand={handleExpand}
            onSelect={handleSelect}
          />
        ) : (
          <FileEmptyState description={query ? '没有匹配的文件' : '此工作区中没有文件'} />
        )}
      </div>
    </Flex>
  )
})

FilesContent.displayName = 'FilesContent'

export function FileEmptyState({ description }: { description: string }) {
  return (
    <Flex align='center' className='h-full min-h-40 flex-1 p-6 text-center' direction='vertical' gap={12} justify='center'>
      <Icon icon={FileText} size={32} />
      <Text className='w-full text-center' fontSize={12} type='secondary'>
        {description}
      </Text>
    </Flex>
  )
}

export default FilesContent
