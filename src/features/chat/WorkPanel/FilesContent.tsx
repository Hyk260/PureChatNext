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
  Check,
  ChevronDown,
  Copy,
  FileText,
  FolderOpen,
  FolderTree,
  FoldVertical,
  GitCompareArrows,
  MoreHorizontal,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getDesktopApi } from '@/types/desktop'
import type {
  DesktopProject,
  DesktopProjectEntry,
  DesktopProjectGitChange,
  DesktopProjectGitStatus,
} from '@/types/desktop'

type DirectoryState = {
  entries?: DesktopProjectEntry[]
  error?: string
  gitChanges?: DesktopProjectGitChange[]
  isGitRepository?: boolean
}
type DirectoryCache = Record<string, DirectoryState>
type ProjectDirectoryCache = { directories: DirectoryCache; projectId: string | null }
type FileViewMode = 'changes' | 'project'
type GitTreeEntry = {
  children: Map<string, GitTreeEntry>
  isDirectory: boolean
  name: string
  path: string
  status?: DesktopProjectGitStatus
}
const ROOT_KEY = '/'
const EMPTY_GIT_CHANGES: DesktopProjectGitChange[] = []
const EMPTY_DIRECTORY_CACHE: DirectoryCache = {}
const ROOT_EXPANDED_KEYS = [ROOT_KEY]

const GIT_STATUS_CLASS: Record<DesktopProjectGitStatus, string> = {
  '?': 'text-green-600 dark:text-green-400',
  A: 'text-green-600 dark:text-green-400',
  C: 'text-green-600 dark:text-green-400',
  D: 'text-red-600 dark:text-red-400',
  M: 'text-orange-600 dark:text-orange-400',
  R: 'text-blue-600 dark:text-blue-400',
  T: 'text-orange-600 dark:text-orange-400',
  U: 'text-red-600 dark:text-red-400',
}

const renderStatusIndicator = (status?: DesktopProjectGitStatus, hasChanges?: boolean) => {
  if (status) return <span className={`shrink-0 text-[10px] font-medium ${GIT_STATUS_CLASS[status]}`}>{status}</span>
  if (!hasChanges) return null
  return <span aria-label='包含 Git 变更' className='size-1.5 shrink-0 rounded-full bg-primary' role='img' />
}

async function readDirectory(projectId: string, relativePath: string): Promise<DirectoryState> {
  try {
    const result = await getDesktopApi()!.listProjectEntries({ projectId, relativePath })
    return {
      entries: result.entries,
      gitChanges: result.gitChanges,
      isGitRepository: result.isGitRepository,
    }
  } catch (error) {
    return { error: getErrorMessage(error, '读取文件夹失败') }
  }
}

const renderEntryTitle = ({
  hasChanges,
  ignored,
  name,
  path,
  status,
}: {
  hasChanges?: boolean
  ignored?: boolean
  name: string
  path: string
  status?: DesktopProjectGitStatus
}) => (
  <span className={`flex min-w-0 flex-1 items-center gap-1.5 ${ignored ? 'opacity-70' : ''}`} title={path}>
    <Text className='min-w-0 flex-1 truncate' fontSize={12}>
      {name}
    </Text>
    {renderStatusIndicator(status, hasChanges)}
  </span>
)

const renderFileTypeIcon = (name: string, type: 'file' | 'folder', ignored = false, open = false) => (
  <span className={ignored ? 'opacity-70' : undefined}>
    <MaterialFileTypeIcon
      aria-hidden
      fallbackUnknownType={false}
      filename={name}
      open={open}
      size={type === 'folder' ? 18 : 16}
      type={type}
    />
  </span>
)

const getChangedDirectoryPaths = (changes: DesktopProjectGitChange[]) => {
  const paths = new Set<string>()
  for (const { path } of changes) {
    const segments = path.split('/')
    for (let index = 1; index < segments.length; index++) paths.add(segments.slice(0, index).join('/'))
  }
  return paths
}

const getGitChangesByPath = (changes: DesktopProjectGitChange[]) => {
  const changesByPath = new Map<string, DesktopProjectGitStatus>()
  for (const change of changes) changesByPath.set(change.path, change.status)
  return changesByPath
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
  query: string,
  changesByPath: Map<string, DesktopProjectGitStatus>,
  changedDirectories: Set<string>,
  hideIgnored: boolean
): TreeDataNode[] {
  const buildDirectory = (name: string, relativePath: string, parentMatches = false): TreeDataNode | null => {
    const key = relativePath || ROOT_KEY
    const directory = directories[relativePath]
    const matches = parentMatches || name.toLowerCase().includes(query)
    const children: TreeDataNode[] = []
    for (const entry of directory?.entries ?? []) {
      const path = relativePath ? `${relativePath}/${entry.name}` : entry.name
      if (hideIgnored && entry.gitIgnored) continue
      if (entry.isDirectory) {
        const child = buildDirectory(entry.name, path, matches)
        if (child) children.push(child)
      } else if (!query || matches || entry.name.toLowerCase().includes(query)) {
        children.push({
          icon: renderFileTypeIcon(entry.name, 'file', entry.gitIgnored),
          isLeaf: true,
          key: path,
          title: renderEntryTitle({ ignored: entry.gitIgnored, name: entry.name, path, status: changesByPath.get(path) }),
        })
      }
    }
    if (query && !matches && children.length === 0 && relativePath) return null
    if (!children.length && (!query || matches)) {
      let label = '展开文件夹以加载内容'
      if (directory?.error) label = `${directory.error}（收起后展开重试）`
      else if (directory?.entries?.length && hideIgnored) label = '已隐藏 Git 忽略的文件'
      else if (directory?.entries) label = '此文件夹为空'
      children.push({ disabled: true, isLeaf: true, key: `${key}//status`, title: label })
    }
    return {
      children,
      icon: renderFileTypeIcon(name, 'folder', false, expanded.has(key) || Boolean(query)),
      key,
      title: renderEntryTitle({
        hasChanges: changedDirectories.has(relativePath),
        name,
        path: relativePath || project.rootPath,
      }),
    }
  }
  const root = buildDirectory(project.name, '')
  if (!root || (query && !root.children?.length)) return []
  return [root]
}

function buildGitChangesTree(
  project: DesktopProject,
  changes: DesktopProjectGitChange[],
  expanded: Set<string>,
  query: string
): TreeDataNode[] {
  const root: GitTreeEntry = { children: new Map(), isDirectory: true, name: project.name, path: '' }
  for (const change of changes) {
    const segments = change.path.split('/').filter(Boolean)
    let parent = root
    for (let index = 0; index < segments.length; index++) {
      const name = segments[index]
      const relativePath = segments.slice(0, index + 1).join('/')
      let entry = parent.children.get(name)
      if (!entry) {
        entry = {
          children: new Map(),
          isDirectory: index < segments.length - 1,
          name,
          path: relativePath,
        }
        parent.children.set(name, entry)
      }
      if (index === segments.length - 1) entry.status = change.status
      parent = entry
    }
  }

  const buildEntry = (entry: GitTreeEntry, parentMatches = false): TreeDataNode | null => {
    const matches = parentMatches || entry.name.toLowerCase().includes(query)
    const children = [...entry.children.values()]
      .map((child) => buildEntry(child, matches))
      .filter((child): child is TreeDataNode => child !== null)
    if (query && !matches && (!entry.isDirectory || children.length === 0)) return null

    return {
      children,
      disabled: entry.status === 'D',
      icon: renderFileTypeIcon(
        entry.name,
        entry.isDirectory ? 'folder' : 'file',
        false,
        expanded.has(entry.path) || Boolean(query)
      ),
      isLeaf: !entry.isDirectory,
      key: entry.path,
      title: renderEntryTitle({
        hasChanges: entry.isDirectory,
        name: entry.name,
        path: entry.path,
        status: entry.status,
      }),
    }
  }

  const children = [...root.children.values()]
    .map((entry) => buildEntry(entry))
    .filter((entry): entry is TreeDataNode => entry !== null)
  if (children.length === 0) return []

  return [
    {
      children,
      icon: renderFileTypeIcon(project.name, 'folder', false, expanded.has(ROOT_KEY) || Boolean(query)),
      key: ROOT_KEY,
      title: renderEntryTitle({ name: project.name, path: project.rootPath }),
    },
  ]
}

function collectDirectoryKeys(nodes: TreeDataNode[]): string[] {
  return nodes.flatMap((node) => (node.isLeaf ? [] : [node.key, ...collectDirectoryKeys(node.children ?? [])]))
}

const FilesContent = memo<Props>(({ activePath, error, loading, onOpenFile, project }) => {
  const [directoryCache, setDirectoryCache] = useState<ProjectDirectoryCache>({ directories: {}, projectId: null })
  const [expandedState, setExpandedState] = useState({ keys: [ROOT_KEY], projectId: null as string | null })
  const [viewState, setViewState] = useState<{ mode: FileViewMode; projectId: string | null }>({
    mode: 'project',
    projectId: null,
  })
  const [filter, setFilter] = useState('')
  const [hideIgnoredFiles, setHideIgnoredFiles] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const requestsRef = useRef({ pending: new Set<string>(), generation: 0 })
  const directories =
    directoryCache.projectId === project?.id ? directoryCache.directories : EMPTY_DIRECTORY_CACHE
  const expandedKeys = expandedState.projectId === project?.id ? expandedState.keys : ROOT_EXPANDED_KEYS
  const rootDirectory = directories['']
  const gitChanges = rootDirectory?.gitChanges ?? EMPTY_GIT_CHANGES
  const isGitRepository = rootDirectory?.isGitRepository ?? false
  const viewMode = isGitRepository && viewState.projectId === project?.id ? viewState.mode : 'project'

  const updateExpandedKeys = useCallback(
    (keys: string[]) => setExpandedState({ keys, projectId: project?.id ?? null }),
    [project?.id]
  )

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
        setDirectoryCache((current) => ({
          directories: {
            ...(current.projectId === project.id ? current.directories : {}),
            [relativePath]: directory,
          },
          projectId: project.id,
        }))
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
      setDirectoryCache({ directories: { '': directory }, projectId: project.id })
      requests.pending.delete('')
    })
    return () => {
      requests.generation++
      requests.pending.clear()
    }
  }, [project])

  const handleRefresh = useCallback(() => {
    if (!project) return
    requestsRef.current.generation++
    requestsRef.current.pending.clear()
    setDirectoryCache({
      directories: directories[''] ? { '': directories[''] } : {},
      projectId: project.id,
    })
    updateExpandedKeys([ROOT_KEY])
    loadDirectory('')
  }, [directories, loadDirectory, project, updateExpandedKeys])

  const query = filter.trim().toLowerCase()
  const changesByPath = useMemo(() => getGitChangesByPath(gitChanges), [gitChanges])
  const changedDirectories = useMemo(() => getChangedDirectoryPaths(gitChanges), [gitChanges])
  const nodes = useMemo(
    () => {
      if (!project) return []
      const expanded = new Set(expandedKeys)
      if (viewMode === 'changes') return buildGitChangesTree(project, gitChanges, expanded, query)
      return buildProjectTree(
        project,
        directories,
        expanded,
        query,
        changesByPath,
        changedDirectories,
        hideIgnoredFiles
      )
    },
    [changedDirectories, changesByPath, directories, expandedKeys, gitChanges, hideIgnoredFiles, project, query, viewMode]
  )
  const visibleExpandedKeys = query ? collectDirectoryKeys(nodes) : expandedKeys

  const handleExpand = (keys: string[]) => {
    updateExpandedKeys(keys)
    if (viewMode === 'changes') return
    for (const key of keys) {
      const path = key === ROOT_KEY ? '' : key
      if (!directories[path]?.entries) loadDirectory(path)
    }
  }

  const handleViewModeChange = useCallback(
    (mode: FileViewMode) => {
      if (!project) return
      setViewState({ mode, projectId: project.id })
      if (mode === 'project') {
        updateExpandedKeys([ROOT_KEY])
        return
      }

      const changeTree = buildGitChangesTree(project, gitChanges, new Set(), query)
      updateExpandedKeys(collectDirectoryKeys(changeTree))
    },
    [gitChanges, project, query, updateExpandedKeys]
  )

  const viewItems = useMemo(
    () => [
      {
        extra: viewMode === 'project' ? <Icon icon={Check} size={14} /> : undefined,
        icon: <Icon icon={FolderTree} size={14} />,
        key: 'project',
        label: '项目',
        onClick: () => handleViewModeChange('project'),
      },
      {
        disabled: !isGitRepository,
        extra: viewMode === 'changes' ? <Icon icon={Check} size={14} /> : undefined,
        icon: <Icon icon={GitCompareArrows} size={14} />,
        key: 'changes',
        label: 'Git 变更',
        onClick: () => handleViewModeChange('changes'),
      },
    ],
    [handleViewModeChange, isGitRepository, viewMode]
  )

  const handleCollapseAll = () => {
    setFilter('')
    updateExpandedKeys([])
  }

  const handleSelect = (_keys: string[], { node }: { node: TreeDataNode }) => {
    if (node.disabled) return
    if (node.isLeaf) {
      onOpenFile(node.key)
      return
    }
    const keys = expandedKeys.includes(node.key)
      ? expandedKeys.filter((key) => key !== node.key)
      : [...expandedKeys, node.key]
    handleExpand(keys)
  }

  const handleOpenProject = useCallback(async () => {
    if (!project) return
    try {
      await getDesktopApi()?.openPath(project.rootPath)
    } catch (openError) {
      toast.error(getErrorMessage(openError, '打开项目失败'))
    }
  }, [project])

  const handleCopyPath = useCallback(async () => {
    if (!project) return
    try {
      await navigator.clipboard.writeText(project.rootPath)
      toast.success('已复制项目路径')
    } catch {
      toast.error('复制路径失败')
    }
  }, [project])

  const moreItems = useMemo(
    () => [
      { icon: <Icon icon={RefreshCw} />, key: 'refresh', label: '刷新文件列表', onClick: handleRefresh },
      { icon: <Icon icon={FolderOpen} />, key: 'open', label: '在系统中打开项目', onClick: handleOpenProject },
      { icon: <Icon icon={Copy} />, key: 'copy', label: '复制项目路径', onClick: handleCopyPath },
      { key: 'filter-divider', type: 'divider' as const },
      {
        checked: hideIgnoredFiles,
        disabled: !isGitRepository,
        key: 'hide-ignored-files',
        label: '不包含已忽略文件',
        onCheckedChange: setHideIgnoredFiles,
        type: 'checkbox' as const,
      },
    ],
    [handleCopyPath, handleOpenProject, handleRefresh, hideIgnoredFiles, isGitRepository]
  )

  if (!getDesktopApi()?.listProjectEntries) return <FileEmptyState description='文件列表仅在桌面端可用' />
  if (loading) return <FileEmptyState description='正在加载项目...' />
  if (error) return <FileEmptyState description={error} />
  if (!project) return <FileEmptyState description='此工作区中没有文件' />

  const viewLabel = viewMode === 'project' ? '项目' : 'Git 变更'
  const getEmptyDescription = () => {
    if (viewMode === 'changes') return query ? '没有匹配的 Git 变更' : '暂无 Git 变更'
    if (query) return '没有匹配的文件'
    return '此工作区中没有文件'
  }

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
          <DropdownMenu items={viewItems} placement='bottomLeft'>
            <button
              aria-label={`文件视图：${viewLabel}`}
              className='flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 text-left hover:bg-secondary'
              type='button'
            >
              <Icon icon={viewMode === 'project' ? FolderTree : GitCompareArrows} size={16} />
              <Text className='min-w-0 flex-1 truncate' fontSize={13} weight={500}>
                {viewLabel}
              </Text>
              <Icon icon={ChevronDown} size={12} />
            </button>
          </DropdownMenu>
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
        <DropdownMenu items={moreItems}>
          <ActionIcon aria-label='更多' icon={MoreHorizontal} size='small' title='更多' />
        </DropdownMenu>
      </Flex>
      <div aria-label={viewMode === 'project' ? '项目文件' : 'Git 变更文件'} className='min-h-0 flex-1 overflow-auto px-1 pb-2'>
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
          <FileEmptyState description={getEmptyDescription()} />
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
