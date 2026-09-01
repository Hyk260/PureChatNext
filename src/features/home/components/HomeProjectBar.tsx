'use client'

import { ActionIcon, Button, Flex, Icon, Input, Modal, Popover, Text } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { Check, Folder, FolderPlus, Plus, X } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
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
    gap: 8px;
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
  menuAction: css`
    justify-content: flex-start;
    width: 100%;
    height: auto;
    padding: 8px 12px;
    border-radius: 12px;
  `,
  projectRow: css`
    border-radius: 12px;

    &:hover {
      background: ${cssVar.colorFillSecondary};
    }
  `,
  selectButton: css`
    justify-content: flex-start;
    flex: 1;
    min-width: 0;
    height: auto;
    padding: 4px;
    border-radius: 8px;
  `,
  trigger: css`
    display: inline-flex;
    gap: 6px;
    align-items: center;

    max-width: 240px;
    height: 28px;
    padding-inline: 10px;
    border: 1px solid color-mix(in srgb, ${cssVar.colorBorder} 80%, transparent);
    border-radius: 999px;

    color: ${cssVar.colorTextSecondary};
    font-size: 12px;
    background: ${cssVar.colorBgContainer};
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);

    &:hover:not(:disabled) {
      color: ${cssVar.colorText} !important;
      background: ${cssVar.colorFillSecondary} !important;
    }
  `,
}))

export interface HomeProjectBarProps {
  disabled?: boolean
  onChange: (project: DesktopProject | null) => void
  value: DesktopProject | null
}

const HomeProjectBar = memo<HomeProjectBarProps>(({ disabled, onChange, value }) => {
  const { message } = useApp()
  const [open, setOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [projects, setProjects] = useState<DesktopProject[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [rootPath, setRootPath] = useState('')

  const refreshProjects = useCallback(async () => {
    const api = getDesktopApi()
    if (!api?.listProjects) return
    setLoading(true)
    try {
      setProjects(await api.listProjects())
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载项目失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void refreshProjects()
  }, [refreshProjects])

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
      message.error('当前环境不支持选择文件夹')
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
      message.error(error instanceof Error ? error.message : '选择文件夹失败')
    }
  }, [message])

  const handleCreate = useCallback(async () => {
    const api = getDesktopApi()
    if (!api?.createProject) {
      message.error('当前环境不支持创建项目')
      return
    }
    const nextName = name.trim()
    if (!nextName) {
      message.error('请填写项目名称')
      return
    }
    if (!rootPath) {
      message.error('请添加源文件夹')
      return
    }

    setCreating(true)
    try {
      const project = await api.createProject({ name: nextName, rootPath })
      setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)])
      onChange(project)
      setCreateOpen(false)
      resetCreateForm()
      message.success(`已创建项目：${project.name}`)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建项目失败')
    } finally {
      setCreating(false)
    }
  }, [message, name, onChange, resetCreateForm, rootPath])

  const handleSelect = useCallback(
    (project: DesktopProject) => {
      onChange(project)
      setOpen(false)
    },
    [onChange]
  )

  const handleClear = useCallback(() => {
    onChange(null)
    setOpen(false)
  }, [onChange])

  const handleDelete = useCallback(
    async (project: DesktopProject) => {
      const api = getDesktopApi()
      if (!api?.deleteProject) return
      try {
        await api.deleteProject(project.id)
        setProjects((current) => current.filter((item) => item.id !== project.id))
        if (value?.id === project.id) onChange(null)
        message.success(`已删除项目：${project.name}`)
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除项目失败')
      }
    },
    [message, onChange, value?.id]
  )

  const triggerLabel = value ? value.name : '选择项目'
  const canCreate = Boolean(name.trim() && rootPath) && !creating
  const triggerAriaLabel = value ? `当前项目：${value.name}` : '选择项目'

  const popoverContent = useMemo(
    () => (
      <Flex className='flex-col w-[min(320px,calc(100vw-32px))] p-1'>
        <Text className='px-3 pb-2 pt-1' type='secondary'>
          项目
        </Text>
        <Flex className='flex-col gap-1 max-h-64 overflow-y-auto'>
          {loading ? (
            <Text className='px-3 py-2' type='secondary' style={{ fontSize: 12 }}>
              加载中…
            </Text>
          ) : null}
          {!loading && projects.length === 0 ? (
            <Text className='px-3 py-2' type='secondary' style={{ fontSize: 12 }}>
              还没有项目，先创建一个吧
            </Text>
          ) : null}
          {projects.map((project) => {
            const active = value?.id === project.id
            return (
              <Flex className={[styles.projectRow, 'flex-row items-center gap-1 px-2 py-1.5']} key={project.id}>
                <Button
                  className={styles.selectButton}
                  type='text'
                  onClick={() => handleSelect(project)}
                >
                  <Icon icon={Folder} size={16} />
                  <Flex className='flex-col flex-1 min-w-0'>
                    <Text ellipsis>{project.name}</Text>
                    <Text ellipsis type='secondary' style={{ fontSize: 12 }}>
                      {project.rootPath}
                    </Text>
                  </Flex>
                  {active ? <Icon icon={Check} size={16} /> : null}
                </Button>
                <ActionIcon
                  icon={X}
                  size='small'
                  title={`删除项目 ${project.name}`}
                  onClick={() => void handleDelete(project)}
                />
              </Flex>
            )
          })}
        </Flex>
        <Flex className='flex-col gap-1 mt-1 pt-1 border-t border-(--ant-color-border-secondary)'>
          {value ? (
            <Button className={styles.menuAction} type='text' onClick={handleClear}>
              <Text type='secondary' style={{ fontSize: 12 }}>
                不使用项目
              </Text>
            </Button>
          ) : null}
          <Button className={styles.menuAction} icon={<Icon icon={Plus} size={16} />} type='text' onClick={handleOpenCreate}>
            创建项目
          </Button>
        </Flex>
      </Flex>
    ),
    [handleClear, handleDelete, handleOpenCreate, handleSelect, loading, projects, value]
  )

  return (
    <>
      <Popover
        content={popoverContent}
        open={open}
        placement='topLeft'
        trigger='click'
        onOpenChange={(nextOpen) => !disabled && setOpen(nextOpen)}
      >
        <Button
          aria-expanded={open}
          aria-label={triggerAriaLabel}
          className={styles.trigger}
          disabled={disabled}
          icon={<Icon icon={Folder} size={13} />}
          size='small'
          title={value?.rootPath}
          type='text'
        >
          <Text ellipsis style={{ fontSize: 12 }}>
            {triggerLabel}
          </Text>
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
        onOk={() => void handleCreate()}
      >
        <Flex className='flex-col gap-4 py-1'>
          <Input
            placeholder='项目名称'
            prefix={<Icon icon={Folder} size={16} />}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Flex className='flex-col gap-2'>
            <Text type='secondary' style={{ fontSize: 13 }}>
              源文件夹
            </Text>
            <Flex
              className={styles.folderDropzone}
              role='button'
              tabIndex={0}
              onClick={() => void handleChooseFolder()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  void handleChooseFolder()
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
