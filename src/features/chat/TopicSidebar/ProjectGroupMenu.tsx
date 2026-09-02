'use client'

import { ActionIcon, confirmModal, DropdownMenu, Icon } from '@pure/ui'
import type { MenuProps } from '@pure/ui'
import { FolderOpen, MessageSquarePlus, MoreHorizontal, Trash2 } from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
import { getDesktopApi } from '@/types/desktop'

type Props = {
  disabled?: boolean
  onDeleteProject?: (projectName: string) => void | Promise<void>
  onNewTopicInProject?: (projectName: string) => void
  projectName: string
  topicCount: number
}

const ProjectGroupMenu = memo<Props>(({ disabled, projectName, topicCount, onDeleteProject, onNewTopicInProject }) => {
  const { message } = useApp()
  const [open, setOpen] = useState(false)
  const isDesktop = Boolean(getDesktopApi())

  const handleOpenFolder = useCallback(async () => {
    const api = getDesktopApi()
    if (!api?.listProjects || !api.openPath) {
      message.error('当前环境不支持打开文件夹')
      return
    }
    setOpen(false)
    try {
      const projects = await api.listProjects()
      const project = projects.find((item) => item.name === projectName)
      if (!project) {
        message.error('未找到该项目的源文件夹')
        return
      }
      await api.openPath(project.rootPath)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '打开文件夹失败')
    }
  }, [message, projectName])

  const handleDeleteProject = useCallback(() => {
    setOpen(false)
    confirmModal({
      cancelText: '取消',
      content: `将删除项目「${projectName}」及其下 ${topicCount} 个话题和消息，此操作无法撤销。`,
      okButtonProps: { danger: true },
      okText: '删除项目',
      title: '删除整个项目？',
      onOk: () => onDeleteProject(projectName),
    })
  }, [onDeleteProject, projectName, topicCount])

  const items = useMemo<MenuProps['items']>(() => {
    const next: MenuProps['items'] = []
    if (onNewTopicInProject) {
      next.push({
        icon: <Icon icon={MessageSquarePlus} />,
        key: 'new-topic-in-project',
        label: '在此项目中开启新话题',
        onClick: () => {
          setOpen(false)
          onNewTopicInProject(projectName)
        },
      })
    }
    if (isDesktop) {
      next.push({
        icon: <Icon icon={FolderOpen} />,
        key: 'open-folder',
        label: '打开文件夹',
        onClick: () => void handleOpenFolder(),
      })
    }
    if (onDeleteProject) {
      next.push({
        danger: true,
        icon: <Icon icon={Trash2} />,
        key: 'delete-project',
        label: '删除整个项目',
        onClick: handleDeleteProject,
      })
    }
    return next
  }, [handleDeleteProject, handleOpenFolder, isDesktop, onDeleteProject, onNewTopicInProject, projectName])

  return (
    <span
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <DropdownMenu items={items} open={open} placement='bottomRight' onOpenChange={setOpen}>
        <ActionIcon disabled={disabled} icon={MoreHorizontal} size='small' title={`项目操作：${projectName}`} />
      </DropdownMenu>
    </span>
  )
})

ProjectGroupMenu.displayName = 'ProjectGroupMenu'

export default ProjectGroupMenu
