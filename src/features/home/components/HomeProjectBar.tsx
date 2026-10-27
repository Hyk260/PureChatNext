'use client'

import { getErrorMessage } from '@pure/utils/error'

import { Flex, Modal } from '@pure/ui'
import { ActionIcon, Button, Icon, Input, Popover, Text, toast, createStaticStyles, cssVar, cx } from '@lobehub/ui'
import { Check, ChevronDown, Folder, FolderOpen, FolderPlus, Search, Star, X } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

import { getDesktopApi } from '@/types/desktop'
import type { DesktopProject } from '@/types/desktop'

function pathBasename(value: string) {
  return value.split(/[/\\]/).filter(Boolean).at(-1) ?? value
}

// 触发胶囊 / 虚线选区 / 菜单项含 hover 多状态，且静态 className 会超 120 字符
const styles = createStaticStyles(({ css }) => ({
  folderDropzone: css`
    cursor: pointer;

    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
    justify-content: center;

    width: 100%;
    min-height: 108px;
    padding: 24px 16px;
    border: 1px dashed ${cssVar.colorBorder};
    border-radius: 16px;

    color: ${cssVar.colorTextSecondary};
    font-size: 14px;
    background: color-mix(in srgb, ${cssVar.colorFillSecondary} 40%, transparent);

    &:hover {
      background: ${cssVar.colorFillSecondary};
    }
  `,
  // 行内操作在 hover / 键盘聚焦时出现；触屏始终可见。
  projectRow: css`
    display: flex;
    gap: 4px;
    align-items: center;
    padding-inline-end: 8px;
    border-radius: 10px;
    transition: background 0.15s;

    &[data-active='true'], &:hover, &:focus-within {
      background: ${cssVar.colorFillTertiary};
    }

    &:hover .project-row-actions, &:focus-within .project-row-actions {
      pointer-events: auto;
      opacity: 1;
    }
  `,
  selectButton: css`
    cursor: pointer;
    display: flex;
    flex: 1;
    gap: 10px;
    align-items: center;
    min-width: 0;
    padding: 9px 8px;
    border: none;
    border-radius: 8px;
    color: ${cssVar.colorText};
    text-align: start;
    background: transparent;

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: -2px;
    }
    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  `,
  rowActions: css`
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s;

    @media (hover: none) {
      pointer-events: auto;
      opacity: 1;
    }
  `,
  secondary: css`
    color: ${cssVar.colorTextDescription};
  `,
  selected: css`
    color: ${cssVar.colorSuccess};
  `,
  defaultBadge: css`
    padding-inline: 5px;
    border-radius: 5px;
    color: ${cssVar.colorTextTertiary};
    font-size: 10px;
    line-height: 17px;
    background: ${cssVar.colorFillSecondary};
  `,
  reset: css`
    color: ${cssVar.colorTextDescription};
    font-size: 12px;
  `,
  folderAction: css`
    &:hover:not(:disabled) {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  trigger: css`
    display: inline-flex;
    gap: 6px;
    align-items: center;

    max-width: min(280px, 100%);
    height: 28px;
    padding-inline: 4px;
    border: none;
    border-radius: 10px;

    color: ${cssVar.colorTextSecondary};
    font-size: 14px;
    background: transparent;

    &:hover:not(:disabled) {
      color: ${cssVar.colorText} !important;
      background: ${cssVar.colorFillSecondary} !important;
    }
  `,
}))

export interface HomeProjectBarProps {
  disabled?: boolean
  onChange: (project: DesktopProject | null) => void | Promise<void>
  projectName?: string | null
  value: DesktopProject | null
}

const HomeProjectBar = memo<HomeProjectBarProps>(({ disabled, onChange, projectName, value }) => {
  const [open, setOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [projects, setProjects] = useState<DesktopProject[]>([])
  const [defaultProject, setDefaultProject] = useState<DesktopProject | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [rootPath, setRootPath] = useState('')
  const activeRowRef = useRef<HTMLButtonElement>(null)

  const refreshProjects = useCallback(async () => {
    const api = getDesktopApi()
    if (!api?.listProjects) return
    setLoading(true)
    try {
      const [items, defaultItem] = await Promise.all([api.listProjects(), api.getDefaultProject?.() ?? null])
      setProjects(items)
      setDefaultProject(defaultItem)
    } catch (error) {
      toast.error(getErrorMessage(error, '加载项目失败'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshProjects()
  }, [refreshProjects])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => activeRowRef.current?.scrollIntoView({ block: 'nearest' }))
    return () => window.cancelAnimationFrame(frame)
  }, [open, projects])

  const handleSelect = useCallback(
    async (project: DesktopProject | null) => {
      setSaving(true)
      try {
        await onChange(project)
        setOpen(false)
        setSearch('')
      } catch (error) {
        toast.error(getErrorMessage(error, '切换项目失败'))
      } finally {
        setSaving(false)
      }
    },
    [onChange]
  )

  const resetCreateForm = useCallback(() => {
    setName('')
    setRootPath('')
  }, [])

  const handleOpenCreate = useCallback(() => {
    setOpen(false)
    resetCreateForm()
    setCreateOpen(true)
  }, [resetCreateForm])

  const handleChooseFolder = useCallback(async () => {
    const api = getDesktopApi()
    if (!api?.chooseDirectory) {
      toast.error('当前环境不支持选择文件夹')
      return
    }
    try {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve())
      })
      const selected = await api.chooseDirectory()
      if (!selected) return
      setRootPath(selected)
      setName((current) => current.trim() || pathBasename(selected))
    } catch (error) {
      toast.error(getErrorMessage(error, '选择文件夹失败'))
    }
  }, [])

  const handleCreate = useCallback(async () => {
    const api = getDesktopApi()
    if (!api?.createProject) {
      toast.error('当前环境不支持创建项目')
      return
    }
    const nextName = name.trim()
    if (!nextName) {
      toast.error('请填写项目名称')
      return
    }
    if (!rootPath) {
      toast.error('请添加源文件夹')
      return
    }

    setCreating(true)
    try {
      const project = await api.createProject({ name: nextName, rootPath })
      setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)])
      setCreateOpen(false)
      resetCreateForm()
      toast.success(`已创建项目：${project.name}`)
      await handleSelect(project)
    } catch (error) {
      toast.error(getErrorMessage(error, '创建项目失败'))
    } finally {
      setCreating(false)
    }
  }, [handleSelect, name, resetCreateForm, rootPath])

  const handleToggleDefault = async (project: DesktopProject) => {
    const api = getDesktopApi()
    if (!api?.setDefaultProject) {
      toast.error('请重启桌面端后再设置默认项目')
      return
    }
    setSaving(true)
    try {
      const next = await api.setDefaultProject(defaultProject?.id === project.id ? null : project.id)
      setDefaultProject(next)
      if (!currentProjectName && next) await onChange(next)
      toast.success(next ? `已设为默认项目：${next.name}` : '已取消默认项目')
    } catch (error) {
      toast.error(getErrorMessage(error, '设置默认项目失败'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = useCallback(
    async (project: DesktopProject) => {
      const api = getDesktopApi()
      if (!api?.deleteProject) return
      setSaving(true)
      try {
        await api.deleteProject(project.id)
        setProjects((current) => current.filter((item) => item.id !== project.id))
        if (defaultProject?.id === project.id) setDefaultProject(null)
        toast.success(`已删除项目：${project.name}`)
      } catch (error) {
        toast.error(getErrorMessage(error, '删除项目失败'))
      } finally {
        setSaving(false)
      }
    },
    [defaultProject?.id]
  )

  const currentProject = value ?? projects.find((project) => project.name === projectName) ?? null
  const currentProjectName = currentProject?.name ?? projectName
  const currentTriggerLabel = currentProjectName ?? '选择项目'
  const canCreate = Boolean(name.trim() && rootPath) && !creating
  const triggerAriaLabel = currentProjectName ? `当前项目：${currentProjectName}` : '选择项目'

  const busy = Boolean(disabled || saving)
  const canReset = (currentProjectName ?? null) !== (defaultProject?.name ?? null)
  const query = search.trim().toLocaleLowerCase()
  const filteredProjects = projects.filter((project) =>
    `${project.name} ${project.rootPath}`.toLocaleLowerCase().includes(query)
  )

  const popoverContent = (
    <Flex className='w-[min(360px,calc(100vw-32px))] flex-col gap-1'>
      <Flex className='flex-between px-2 pb-1 pt-1'>
        <Text className={styles.secondary} fontSize={12}>工作目录</Text>
        <Button
          className={styles.reset}
          disabled={busy || loading || !canReset}
          size='small'
          title={defaultProject ? `恢复为 ${defaultProject.name}` : '恢复为无项目会话'}
          type='text'
          onClick={() => handleSelect(defaultProject)}
        >
          恢复默认
        </Button>
      </Flex>
      {projects.length > 8 ? (
        <Flex className='min-w-0 px-2 pb-1'>
          <Input
            aria-label='搜索项目'
            className='min-w-0 w-full'
            placeholder='搜索项目或路径'
            prefix={<Icon icon={Search} size={14} />}
            size='small'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Flex>
      ) : null}
      <Flex className='max-h-72 flex-col gap-0.5 overflow-y-auto'>
        {loading && projects.length === 0 ? (
          <Text className='px-2 py-4 text-center' fontSize={12} type='secondary'>加载中…</Text>
        ) : null}
        {!loading && filteredProjects.length === 0 ? (
          <Text className='px-2 py-4 text-center' fontSize={12} type='secondary'>
            {query ? '没有匹配的项目' : '选择文件夹，开始一个项目'}
          </Text>
        ) : null}
        {filteredProjects.map((project) => {
          const active = currentProject?.id === project.id
          const isDefault = defaultProject?.id === project.id
          const defaultLabel = `${isDefault ? '取消默认项目' : '设为默认项目'} ${project.name}`
          return (
            <Flex className={styles.projectRow} data-active={active} key={project.id}>
              <button
                ref={active ? activeRowRef : undefined}
                aria-label={`选择项目 ${project.name}`}
                aria-pressed={active}
                className={styles.selectButton}
                disabled={busy}
                title={project.rootPath}
                type='button'
                onClick={() => handleSelect(project)}
              >
                <Icon className={cx(styles.secondary, 'flex-none')} icon={Folder} size={18} />
                <span className='min-w-0 flex-1'>
                  <span className='flex items-center gap-1.5'>
                    <span className='truncate text-[13px] font-medium'>{project.name}</span>
                    {isDefault ? <span className={cx(styles.defaultBadge, 'flex-none')}>默认</span> : null}
                  </span>
                  <span className={cx(styles.secondary, 'block truncate text-[12px] leading-5')}>
                    {project.rootPath}
                  </span>
                </span>
              </button>
              <Flex className='flex-none items-center gap-1'>
                <Flex className={cx(styles.rowActions, 'project-row-actions items-center gap-0.5')}>
                  <ActionIcon
                    active={isDefault}
                    aria-label={defaultLabel}
                    aria-pressed={isDefault}
                    disabled={busy}
                    icon={<Star fill={isDefault ? 'currentColor' : 'none'} size={14} />}
                    size={{ blockSize: 24, size: 14 }}
                    title={defaultLabel}
                    onClick={() => handleToggleDefault(project)}
                  />
                  {!active ? (
                    <ActionIcon
                      aria-label={`删除项目 ${project.name}`}
                      disabled={busy}
                      icon={X}
                      size={{ blockSize: 24, size: 14 }}
                      title={`删除项目 ${project.name}`}
                      onClick={() => handleDelete(project)}
                    />
                  ) : null}
                </Flex>
                {active ? <Icon className={styles.selected} icon={Check} size={18} /> : null}
              </Flex>
            </Flex>
          )
        })}
      </Flex>
      <button
        className={cx(styles.selectButton, styles.folderAction, styles.secondary)}
        disabled={busy}
        type='button'
        onClick={handleOpenCreate}
      >
        <Icon className='flex-none' icon={FolderOpen} size={18} />
        <span className='text-[13px]'>选择其他文件夹</span>
      </button>
    </Flex>
  )

  return (
    <>
      <Popover
        content={popoverContent}
        open={open}
        placement='topLeft'
        styles={{ content: { padding: 4 } }}
        trigger='click'
        onOpenChange={(nextOpen) => {
          if (busy) return
          setOpen(nextOpen)
          if (nextOpen) refreshProjects()
          else setSearch('')
        }}
      >
        <Button
          aria-expanded={open}
          aria-label={triggerAriaLabel}
          className={styles.trigger}
          disabled={busy}
          icon={<Icon icon={Folder} size={16} />}
          size='small'
          title={currentProject?.rootPath}
          type='text'
        >
          <Text className='text-[14px]' ellipsis>
            {currentTriggerLabel}
          </Text>
          <Icon className='flex-none opacity-60' icon={ChevronDown} size={12} />
        </Button>
      </Popover>

      <Modal
        cancelText='取消'
        confirmLoading={creating}
        destroyOnHidden
        okButtonProps={{ disabled: !canCreate }}
        okText='创建项目'
        open={createOpen}
        title='创建项目'
        width='min(92vw, 440px)'
        onCancel={() => {
          setCreateOpen(false)
          resetCreateForm()
        }}
        onOk={handleCreate}
      >
        <Flex className='flex-col gap-4 py-1'>
          <Input
            placeholder='项目名称'
            prefix={<Icon icon={Folder} size={16} />}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Flex className='flex-col gap-2'>
            <Text className='text-[13px]' type='secondary'>
              源文件夹
            </Text>
            <Flex
              className={styles.folderDropzone}
              role='button'
              tabIndex={0}
              onClick={handleChooseFolder}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  handleChooseFolder()
                }
              }}
            >
              <Icon icon={FolderPlus} size={22} />
              {rootPath ? (
                <Text ellipsis title={rootPath}>
                  {rootPath}
                </Text>
              ) : (
                <Text type='secondary'>添加 PureChat 可读取和编辑的文件夹</Text>
              )}
            </Flex>
          </Flex>
        </Flex>
      </Modal>
    </>
  )
})

HomeProjectBar.displayName = 'HomeProjectBar'

export default HomeProjectBar
