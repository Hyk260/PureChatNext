'use client'

import { confirmModal, DropdownMenu, Icon, Input, Modal, Text, Flexbox } from '@pure/ui'
import type { MenuInfo, MenuProps } from '@pure/ui'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import {
  Check,
  Copy,
  FolderInput,
  FolderPlus,
  Hash,
  Link,
  Loader2,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'

import type { LocalChatTopic } from '@/features/chat/types'

const styles = createStaticStyles(({ css }) => ({
  item: css`
    cursor: pointer;
    user-select: none;

    padding-block: 8px;
    padding-inline: 10px;
    border-radius: ${cssVar.borderRadius};

    & .topic-actions {
      opacity: 0;
      transition: opacity 0.15s;
      pointer-events: none;
    }

    &:hover .topic-actions,
    & .topic-actions[data-open='true'] {
      opacity: 1;
      pointer-events: auto;
    }
  `,
  itemActive: css`
    background: ${cssVar.colorFillTertiary};
  `,
  srOnly: css`
    position: absolute;

    overflow: hidden;
    clip: rect(0, 0, 0, 0);

    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    border: 0;

    white-space: nowrap;
  `,
  trigger: css`
    cursor: pointer;

    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;

    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 4px;

    color: ${cssVar.colorTextSecondary};
    background: transparent;
    outline: none;

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
    }
  `,
}))

const stopMenuEvent = (info: MenuInfo) => {
  const event = info.domEvent as { stopPropagation?: () => void } | undefined
  event?.stopPropagation?.()
}

type Props = {
  active: boolean
  autoRenameDisabled: boolean
  autoRenaming: boolean
  projectNames: string[]
  topic: LocalChatTopic
  onAutoRename: (id: string) => void | Promise<void>
  onSelect: (topicId: string) => void
  onRename: (id: string, title: string) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  onFavorite: (id: string, favorite: boolean) => void | Promise<void>
  onProjectChange: (id: string, projectName: string | null) => void | Promise<void>
}

const TopicItem = memo<Props>(
  ({
    active,
    autoRenameDisabled,
    autoRenaming,
    projectNames,
    topic,
    onAutoRename,
    onSelect,
    onRename,
    onDelete,
    onFavorite,
    onProjectChange,
  }) => {
    const [menuOpen, setMenuOpen] = useState(false)
    const [renameOpen, setRenameOpen] = useState(false)
    const [projectOpen, setProjectOpen] = useState(false)
    const [draftTitle, setDraftTitle] = useState(topic.title)
    const [draftProject, setDraftProject] = useState('')
    const [saving, setSaving] = useState(false)

    const handleOpenRename = useCallback(() => {
      setDraftTitle(topic.title)
      setRenameOpen(true)
    }, [topic.title])

    const handleSubmitRename = async () => {
      const next = draftTitle.trim()
      if (!next || saving) return

      setSaving(true)
      try {
        await onRename(topic.id, next)
        setRenameOpen(false)
      } finally {
        setSaving(false)
      }
    }

    const handleOpenProject = useCallback(() => {
      setDraftProject('')
      setProjectOpen(true)
    }, [])

    const handleSubmitProject = async () => {
      const next = draftProject.trim()
      if (!next || saving) return

      setSaving(true)
      try {
        await onProjectChange(topic.id, next)
        setProjectOpen(false)
      } finally {
        setSaving(false)
      }
    }

    const menuItems = useMemo<MenuProps['items']>(
      () => [
        {
          icon: <Icon icon={Star} />,
          key: 'favorite',
          label: topic.favorite ? '取消收藏' : '收藏',
          onClick: (info) => {
            stopMenuEvent(info)
            void onFavorite(topic.id, !topic.favorite)
          },
        },
        {
          children: [
            ...projectNames.map((projectName) => ({
              icon: topic.projectName === projectName ? <Icon icon={Check} /> : <span />,
              key: `project-${projectName}`,
              label: projectName,
              onClick: (info: MenuInfo) => {
                stopMenuEvent(info)
                void onProjectChange(topic.id, projectName)
              },
            })),
            ...(projectNames.length > 0 ? [{ type: 'divider' as const }] : []),
            {
              icon: topic.projectName === null ? <Icon icon={Check} /> : <span />,
              key: 'project-none',
              label: '无项目',
              onClick: (info: MenuInfo) => {
                stopMenuEvent(info)
                void onProjectChange(topic.id, null)
              },
            },
            {
              icon: <Icon icon={FolderPlus} />,
              key: 'project-new',
              label: '新建项目标签…',
              onClick: (info: MenuInfo) => {
                stopMenuEvent(info)
                handleOpenProject()
              },
            },
          ],
          icon: <Icon icon={FolderInput} />,
          key: 'project',
          label: '移动到项目',
        },
        { type: 'divider' },
        {
          disabled: autoRenameDisabled,
          icon: <Icon icon={Sparkles} />,
          key: 'smart-rename',
          label: autoRenaming ? '正在智能重命名…' : '智能重命名',
          onClick: (info) => {
            stopMenuEvent(info)
            if (autoRenameDisabled) return
            void onAutoRename(topic.id)
          },
        },
        {
          icon: <Icon icon={Pencil} />,
          key: 'rename',
          label: '重命名',
          onClick: (info) => {
            stopMenuEvent(info)
            handleOpenRename()
          },
        },
        { type: 'divider' },
        {
          icon: <Icon icon={Copy} />,
          key: 'copy',
          label: '复制',
          onClick: stopMenuEvent,
        },
        {
          icon: <Icon icon={Link} />,
          key: 'copy-link',
          label: '复制链接',
          onClick: stopMenuEvent,
        },
        { type: 'divider' },
        {
          danger: true,
          icon: <Icon icon={Trash2} />,
          key: 'delete',
          label: '删除',
          onClick: (info) => {
            stopMenuEvent(info)
            confirmModal({
              cancelText: '取消',
              content: '话题下的所有消息将一并删除。',
              okButtonProps: { danger: true },
              okText: '删除',
              onOk: () => onDelete(topic.id),
              title: '删除该话题？',
            })
          },
        },
      ],
      [
        autoRenameDisabled,
        autoRenaming,
        handleOpenProject,
        handleOpenRename,
        onAutoRename,
        onDelete,
        onFavorite,
        onProjectChange,
        projectNames,
        topic.favorite,
        topic.id,
        topic.projectName,
      ]
    )

    return (
      <>
        <Flexbox horizontal className={cx(styles.item, active && styles.itemActive)} onClick={() => onSelect(topic.id)}>
          <Flexbox horizontal align='center' gap={4} style={{ width: '100%' }}>
            <Icon
              aria-label={autoRenaming ? '正在智能重命名' : '话题'}
              color={autoRenaming ? cssVar.colorWarning : cssVar.colorTextTertiary}
              icon={autoRenaming ? Loader2 : Hash}
              size={14}
              spin={autoRenaming}
              style={{ flex: 'none' }}
            />
            <Text
              title={topic.title}
              style={{
                color: active ? cssVar.colorText : cssVar.colorTextSecondary,
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {topic.title}
            </Text>
            {/* {topic.favorite ? <Icon color={cssVar.colorWarning} icon={Star} size={14} /> : null} */}
            <Flexbox
              horizontal
              align='center'
              className={cx('topic-actions')}
              data-open={menuOpen || undefined}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <DropdownMenu
                items={menuItems}
                nativeButton
                open={menuOpen}
                placement='bottomLeft'
                triggerProps={{ className: styles.trigger, title: '更多' }}
                onOpenChange={setMenuOpen}
              >
                <Icon icon={MoreHorizontal} size='small' />
                <span className={styles.srOnly}>更多</span>
              </DropdownMenu>
            </Flexbox>
          </Flexbox>
        </Flexbox>

        <Modal
          cancelText='取消'
          confirmLoading={saving}
          destroyOnHidden
          okText='保存'
          open={renameOpen}
          title='重命名话题'
          width={400}
          onCancel={() => setRenameOpen(false)}
          onOk={handleSubmitRename}
        >
          <Flexbox gap={12} style={{ paddingBlock: 8 }}>
            <Text type='secondary'>保持简短且易于识别。</Text>
            <Input
              autoFocus
              onChange={(event) => setDraftTitle(event.target.value)}
              onPressEnter={handleSubmitRename}
              placeholder='话题名称'
              value={draftTitle}
            />
          </Flexbox>
        </Modal>

        <Modal
          cancelText='取消'
          confirmLoading={saving}
          destroyOnHidden
          okText='创建并移动'
          open={projectOpen}
          title='新建项目标签'
          width={400}
          onCancel={() => setProjectOpen(false)}
          onOk={handleSubmitProject}
        >
          <Flexbox gap={12} style={{ paddingBlock: 8 }}>
            <Text type='secondary'>相同名称的话题会整理到同一项目分组。</Text>
            <Input
              autoFocus
              onChange={(event) => setDraftProject(event.target.value)}
              onPressEnter={handleSubmitProject}
              placeholder='项目名称'
              value={draftProject}
            />
          </Flexbox>
        </Modal>
      </>
    )
  }
)

TopicItem.displayName = 'TopicItem'

export default TopicItem
