'use client'

import { Avatar, Center, confirmModal, DropdownMenu, Block, Icon, Text, Flex } from '@pure/ui'
import type { MenuInfo, MenuProps } from '@pure/ui'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import { MoreHorizontal, Pencil, PinIcon, PinOff, Trash2 } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'

import type { AgentListItem } from '@/const/home/agents'
import { useApp } from '@/components/AntdStaticMethods'

const styles = createStaticStyles(({ css }) => ({
  agentItem: css`
    cursor: pointer;
    user-select: none;

    & .agent-actions {
      display: none;
    }

    &:hover .agent-actions,
    & .agent-actions[data-open='true'] {
      display: flex;
    }
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
  pinBadge: css`
    flex: none;
    color: ${cssVar.colorTextTertiary};
  `,
}))

const stopMenuEvent = (info: MenuInfo) => {
  const event = info.domEvent as { stopPropagation?: () => void } | undefined
  event?.stopPropagation?.()
}

interface AgentItemProps {
  agent: AgentListItem
  onDelete: (id: string) => void | Promise<void>
  onEdit: (agent: AgentListItem) => void
  onPin: (agent: AgentListItem, pinned: boolean) => void | Promise<void>
  onSelect: (agent: AgentListItem) => void
}

const AgentItem = memo<AgentItemProps>(({ agent, onDelete, onEdit, onPin, onSelect }) => {
  const { message } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const [actionsMounted, setActionsMounted] = useState(false)
  const canOperate = !agent.isBuiltin
  const isPinned = Boolean(agent.pinned)

  const handleMenuOpenChange = useCallback((next: boolean) => {
    setMenuOpen(next)
    if (next) setActionsMounted(true)
  }, [])

  useEffect(() => {
    if (menuOpen || !actionsMounted) return
    const timer = setTimeout(() => setActionsMounted(false), 200)
    return () => clearTimeout(timer)
  }, [menuOpen, actionsMounted])

  const handleConfirmDelete = useCallback(async () => {
    try {
      await onDelete(agent.id)
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      if (code === 'BUILTIN') message.error('系统内置助理不可删除')
      else message.error('删除失败')
      throw error
    }
  }, [agent.id, message, onDelete])

  const menuItems = useMemo<MenuProps['items']>(
    () => [
      {
        icon: <Icon icon={isPinned ? PinOff : PinIcon} />,
        key: 'pin',
        label: isPinned ? '取消置顶' : '置顶',
        onClick: (info) => {
          stopMenuEvent(info)
          onPin(agent, !isPinned)
        },
      },
      // {
      //   icon: <Icon icon={Pencil} />,
      //   key: 'rename',
      //   label: '重命名',
      //   onClick: (info) => {
      //     stopMenuEvent(info)
      //     onEdit(agent)
      //   },
      // },
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
            content: '删除后不可恢复，该助理下的话题也会一并删除。',
            okButtonProps: { danger: true },
            okText: '删除',
            onOk: () => handleConfirmDelete(),
            title: '删除该助理？',
          })
        },
      },
    ],
    [agent, handleConfirmDelete, isPinned, onPin]
  )

  return (
    <Block
      key={agent.id}
      clickable
      horizontal
      align='center'
      className={styles.agentItem}
      gap={8}
      height={36}
      paddingInline={4}
      variant='borderless'
      onClick={() => onSelect(agent)}
    >
      <Center flex='none' height={28} width={28}>
        <Avatar avatar={agent.avatar} background={agent.backgroundColor ?? undefined} size={28} />
      </Center>
      <Flex className='flex-col flex-1 min-w-[0px] overflow-hidden'>
        <Text
          title={agent.title}
          style={{
            color: cssVar.colorTextSecondary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {agent.title}
        </Text>
      </Flex>
      {isPinned ? (
        <Center className={styles.pinBadge} flex='none' height={24} title='已置顶' width={20}>
          <Icon icon={PinIcon} size={14} />
        </Center>
      ) : null}
      {canOperate ? (
        <Flex
          className={[cx('agent-actions'), 'flex-row items-center']}
          data-open={menuOpen || actionsMounted || undefined}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <DropdownMenu
            items={menuItems}
            nativeButton
            open={menuOpen}
            placement='bottomLeft'
            triggerProps={{ className: styles.trigger, title: '更多' }}
            onOpenChange={handleMenuOpenChange}
          >
            <Icon icon={MoreHorizontal} size='small' />
            <span className={styles.srOnly}>更多</span>
          </DropdownMenu>
        </Flex>
      ) : null}
    </Block>
  )
})

AgentItem.displayName = 'AgentItem'

export default AgentItem
