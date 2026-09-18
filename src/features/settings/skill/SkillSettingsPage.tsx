'use client'

import { ActionIcon, Avatar, Button, Empty, Flex, Text } from '@pure/ui'
import { Highlighter } from '@pure/ui/Markdown'
import { formatDate } from '@pure/utils/client'
import { createStaticStyles, cssVar } from 'antd-style'
import { ChevronDown, ChevronRight, CircleX, LayoutGrid } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
import FileIcon from '@/components/FileIcon'
import Scrollbar from '@/components/Scrollbar'
import { githubAssetAvatar } from '@/const/community/githubAssetUrl'
import { getSkillFileExtension, getSkillFilePreviewKind } from '@/const/community/skillFilePreview'
import { findCommunitySkill } from '@/const/community/skills'
import MessageMarkdown from '@/features/chat/MessageMarkdown'
import { confirmUninstallSkill, deleteUserSkill } from '@/features/community/uninstallSkill'
import SettingsHeader from '@/features/settings/SettingsHeader'

import { SkillImportMenu } from './skillImportMenu'
import SkillStoreModal from './SkillStoreModal'
import type { SkillFileTreeNode } from './skillFileView'
import { buildFileTree, isHiddenSkillFile } from './skillFileView'

type InstalledSkill = {
  createdAt?: string
  description: string | null
  fileCount: number
  icon: string | null
  id: string
  identifier: string
  name: string
  updatedAt?: string
  version: string | null
}

type SkillFile = {
  fileType: string
  path: string
  size: number
}

type SkillDetail = InstalledSkill & {
  files: SkillFile[]
}

const styles = createStaticStyles(({ css }) => ({
  list: css`
    flex: none;
    width: 280px;
    min-width: 280px;
    height: 100%;
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};
  `,
  listItem: css`
    width: 100%;
    padding: 8px 12px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    text-align: start;
    cursor: pointer;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  listItemActive: css`
    background: ${cssVar.colorFillSecondary};
  `,
  pane: css`
    min-width: 0;
    height: 100%;
    background: ${cssVar.colorBgContainer};
  `,
  tree: css`
    flex: none;
    width: 240px;
    min-width: 240px;
    height: 100%;
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};
  `,
  treeButton: css`
    width: 100%;
    padding: 4px 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    text-align: start;
    cursor: pointer;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  treeButtonActive: css`
    background: ${cssVar.colorFillSecondary};
  `,
}))

const fileUrl = (skillId: string, path: string) =>
  `/api/user/skills/${encodeURIComponent(skillId)}/files?path=${encodeURIComponent(path)}`

const getSkillUpdatedLabel = (identifier: string, fallback?: string | Date | null) => {
  const updatedAt = findCommunitySkill(identifier)?.updatedAt ?? fallback
  if (!updatedAt) return null
  return `更新于 ${formatDate(updatedAt, { day: 'numeric', month: 'short', year: 'numeric' })}`
}

const SkillTreeNode = ({
  node,
  selectedPath,
  onSelect,
}: {
  node: SkillFileTreeNode
  onSelect: (path: string) => void
  selectedPath: string | null
}) => {
  const isFolder = Boolean(node.children)
  const [open, setOpen] = useState(true)
  const isActive = !isFolder && selectedPath === node.path
  const className = isActive ? `${styles.treeButton} ${styles.treeButtonActive}` : styles.treeButton

  if (isFolder) {
    return (
      <Flex className='flex-col'>
        <button className={styles.treeButton} type='button' onClick={() => setOpen((value) => !value)}>
          <Flex className='items-center gap-1 min-w-0'>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {/* variant={open ? 'folder' : 'raw'} */}
            <FileIcon fileName={node.name} isDirectory size={16} variant='raw' />
            <Text ellipsis>{node.name}</Text>
          </Flex>
        </button>
        {open ? (
          <Flex className='flex-col pl-4'>
            {node.children!.map((child) => (
              <SkillTreeNode key={child.path} node={child} selectedPath={selectedPath} onSelect={onSelect} />
            ))}
          </Flex>
        ) : null}
      </Flex>
    )
  }

  return (
    <button className={className} type='button' onClick={() => onSelect(node.path)}>
      <Flex className='items-center gap-1 min-w-0'>
        <FileIcon fileName={node.name} size={16} />
        <Text ellipsis>{node.name}</Text>
      </Flex>
    </button>
  )
}

const SkillTextPreview = ({ path, skillId }: { path: string; skillId: string }) => {
  const kind = getSkillFilePreviewKind(path)
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void fetch(fileUrl(skillId, path), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('file')
        setText(await response.text())
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(true)
      })
    return () => controller.abort()
  }, [path, skillId])

  if (error) return <Text type='secondary'>无法加载文件</Text>
  if (text === null) return <Text type='secondary'>正在加载…</Text>
  if (kind === 'markdown') return <MessageMarkdown text={text} />

  const language = getSkillFileExtension(path) || 'txt'
  return <Highlighter language={language}>{text}</Highlighter>
}

const SkillFilePreview = ({ path, skillId }: { path: string; skillId: string }) => {
  const kind = getSkillFilePreviewKind(path)
  if (kind === 'binary') {
    return (
      <Flex className='flex-1 items-center justify-center min-h-40'>
        <Text type='secondary'>不支持预览</Text>
      </Flex>
    )
  }
  if (kind === 'image') return <img alt={path} className='max-w-full' src={fileUrl(skillId, path)} />
  return <SkillTextPreview key={path} path={path} skillId={skillId} />
}

const SkillDetailPane = ({ skillId }: { skillId: string }) => {
  const { message } = useApp()
  const [detail, setDetail] = useState<SkillDetail | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void fetch(`/api/user/skills/${encodeURIComponent(skillId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('detail')
        const payload = (await response.json()) as SkillDetail
        setDetail(payload)
        setSelectedPath(payload.files.map((file) => file.path).find((path) => !isHiddenSkillFile(path)) ?? null)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        message.error('无法加载技能详情')
      })
    return () => controller.abort()
  }, [message, skillId])

  const tree = useMemo(() => buildFileTree(detail?.files.map((file) => file.path) ?? []), [detail])
  const updatedLabel = detail ? getSkillUpdatedLabel(detail.identifier, detail.updatedAt ?? detail.createdAt) : null

  if (!detail) {
    return (
      <Flex className='items-center justify-center flex-1 h-full w-full'>
        <Text type='secondary'>正在加载…</Text>
      </Flex>
    )
  }

  return (
    <Flex className='flex-1 min-h-0'>
      <Flex className={[styles.tree, 'flex-col min-h-0']}>
        <Scrollbar style={{ flex: 1, minHeight: 0 }}>
          <Flex className='flex-col p-2'>
            {tree.map((node) => (
              <SkillTreeNode key={node.path} node={node} selectedPath={selectedPath} onSelect={setSelectedPath} />
            ))}
          </Flex>
        </Scrollbar>
      </Flex>
      <Flex className='flex-col flex-1 min-h-0 min-w-0'>
        {/* <Flex className='items-start justify-between gap-3 px-5 py-4' style={{ flex: 'none' }}>
          <Flex className='flex-col gap-1 min-w-0'>
            <Flex className='items-center gap-2 min-w-0'>
              <Avatar avatar={detail.icon || detail.name} shape='square' size={28} style={{ flex: 'none' }} />
              <Text ellipsis strong>
                {detail.name}
              </Text>
              {updatedLabel ? (
                <Text className='shrink-0' type='secondary'>
                  {updatedLabel}
                </Text>
              ) : null}
            </Flex>
            {detail.description ? (
              <Text ellipsis={{ rows: 2 }} type='secondary'>
                {detail.description}
              </Text>
            ) : null}
          </Flex>
          <Button danger disabled={uninstalling} onClick={handleUninstall} size='small' style={{ flex: 'none' }}>
            卸载
          </Button>
        </Flex> */}
        <Scrollbar style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
          <Flex className='flex-col flex-1 px-5 pb-5'>
            {selectedPath ? <SkillFilePreview path={selectedPath} skillId={detail.id} /> : null}
          </Flex>
        </Scrollbar>
      </Flex>
    </Flex>
  )
}

export default function SkillSettingsPage() {
  const { message } = useApp()
  const [skills, setSkills] = useState<InstalledSkill[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [communityOpen, setCommunityOpen] = useState(true)
  const [storeOpen, setStoreOpen] = useState(false)
  const [uninstallingId, setUninstallingId] = useState<string | null>(null)

  const refreshList = useCallback((keepId?: string | null) => {
    return fetch('/api/user/skills')
      .then(async (response) => {
        if (!response.ok) throw new Error('list')
        const items = (await response.json()) as InstalledSkill[]
        setSkills(items)
        const nextId = keepId && items.some((item) => item.id === keepId) ? keepId : (items[0]?.id ?? null)
        setSelectedId(nextId)
      })
      .catch(() => {
        setSkills([])
        setSelectedId(null)
        message.error('无法加载已安装技能')
      })
  }, [message])

  useEffect(() => {
    void refreshList()
  }, [refreshList])

  const handleUninstalled = useCallback(() => {
    void refreshList(null)
  }, [refreshList])

  const handleUninstallSkill = useCallback(
    (skillId: string) => {
      if (uninstallingId) return
      confirmUninstallSkill(async () => {
        setUninstallingId(skillId)
        try {
          await deleteUserSkill(skillId)
          message.success('已卸载')
          await refreshList(null)
        } catch {
          message.error('卸载失败')
        } finally {
          setUninstallingId(null)
        }
      })
    },
    [message, refreshList, uninstallingId]
  )

  const handleInstalled = useCallback(
    (skillId?: string) => {
      void refreshList(skillId ?? selectedId)
    },
    [refreshList, selectedId]
  )

  if (skills === null) {
    return (
      <Flex className='items-center justify-center h-full w-full'>
        <Text type='secondary'>正在加载…</Text>
      </Flex>
    )
  }

  return (
    <Flex className='h-full min-h-0 w-full'>
      <Flex className={[styles.list, 'flex-col min-h-0']}>
        <Flex
          className='h-10 items-center justify-between gap-2 px-3 py-2 border-b border-border'
          style={{ flex: 'none' }}
        >
          <Text strong>技能</Text>
          <Flex className='items-center gap-1'>
            <ActionIcon icon={LayoutGrid} size='small' title='技能商店' onClick={() => setStoreOpen(true)} />
            {/* <SkillImportMenu /> */}
          </Flex>
        </Flex>
        <Scrollbar style={{ flex: 1, minHeight: 0 }}>
          <Flex className='flex-col gap-1 p-2'>
            <button className={styles.treeButton} type='button' onClick={() => setCommunityOpen((value) => !value)}>
              <Flex className='items-center gap-1 min-w-0'>
                {communityOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Text type='secondary'>社区技能</Text>
              </Flex>
            </button>
            {communityOpen
              ? skills.map((skill) => {
                  const isActive = skill.id === selectedId
                  const className = isActive ? `${styles.listItem} ${styles.listItemActive}` : styles.listItem
                  return (
                    <Flex className={[className, 'group items-center gap-1']} key={skill.id}>
                      <button
                        className='flex flex-1 items-center gap-2 min-w-0 border-0 bg-transparent p-0 text-start cursor-pointer'
                        type='button'
                        onClick={() => setSelectedId(skill.id)}
                      >
                        <Avatar avatar={githubAssetAvatar(skill.icon, skill.name)} shape='square' size={28} />
                        <Text ellipsis>{skill.name}</Text>
                      </button>
                      <span
                        className={
                          uninstallingId === skill.id
                            ? 'opacity-100'
                            : 'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100'
                        }
                      >
                        <ActionIcon
                          disabled={uninstallingId === skill.id}
                          icon={CircleX}
                          size='small'
                          title='卸载'
                          onClick={() => handleUninstallSkill(skill.id)}
                        />
                      </span>
                    </Flex>
                  )
                })
              : null}
          </Flex>
        </Scrollbar>
      </Flex>

      <Flex className={[styles.pane, 'flex-col flex-1 min-w-0']}>
        <SettingsHeader />
        {selectedId ? (
          <SkillDetailPane key={selectedId} skillId={selectedId} />
        ) : (
          <Flex className='items-center justify-center flex-1'>
            <Empty description='从技能商店安装' />
          </Flex>
        )}
      </Flex>

      <SkillStoreModal
        installedSkills={skills}
        open={storeOpen}
        onClose={() => setStoreOpen(false)}
        onInstalled={handleInstalled}
        onUninstalled={handleUninstalled}
      />
    </Flex>
  )
}
