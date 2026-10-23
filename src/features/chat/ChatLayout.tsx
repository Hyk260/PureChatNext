'use client'

import { createStaticStyles } from '@lobehub/ui'
import { Flex } from '@pure/ui'
import type { UIMessage } from 'ai'
import { memo } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import ChatHeader from '@/features/chat/ChatHeader'
import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import type { LocalChatTopic } from '@/features/chat/types'
import {
  COMPACT_LAYOUT_WIDTH,
  MIN_CHAT_WIDTH,
  MIN_FILE_PREVIEW_WIDTH,
  MIN_WORK_PANEL_WIDTH,
  MAX_WORK_PANEL_WIDTH,
  PANEL_TRANSITION,
} from '@/features/chat/WorkPanel/panelSizing'
import { useWorkPanelLayoutStore } from '@/features/chat/WorkPanel/usePanelResize'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import InsetContentFrame from '@/layout/InsetContentFrame'
import { sidebarResizeStyles, useSidebarResize } from '@/layout/sidebarResize'

const styles = createStaticStyles(({ css }) => ({
  // 分栏尺寸依赖容器宽度、面板开关与持久化的拖拽尺寸。
  container: css`
    container-type: inline-size;
    --work-panel-limit: max(
      0px,
      calc(100cqw - var(--chat-sidebar-width) - var(--chat-frame-gutter) - ${MIN_CHAT_WIDTH}px)
    );
    --expanded-panel-total: min(
      max(
        calc(var(--work-panel-preferred-width) + var(--file-preview-preferred-width)),
        ${MIN_WORK_PANEL_WIDTH + MIN_FILE_PREVIEW_WIDTH}px
      ),
      var(--work-panel-limit)
    );
    --expanded-work-panel-width: clamp(
      min(${MIN_WORK_PANEL_WIDTH}px, var(--expanded-panel-total) * 0.4),
      var(--work-panel-preferred-width),
      min(
        ${MAX_WORK_PANEL_WIDTH}px,
        calc(var(--expanded-panel-total) - min(${MIN_FILE_PREVIEW_WIDTH}px, var(--expanded-panel-total) * 0.5))
      )
    );
    --expanded-file-preview-width: calc(var(--expanded-panel-total) - var(--expanded-work-panel-width));
    --work-panel-width: min(max(${MIN_WORK_PANEL_WIDTH}px, var(--work-panel-preferred-width)), var(--work-panel-limit));
    --file-preview-width: 0px;
    --work-panel-total-width: var(--work-panel-width);

    &:has([data-preview-open='true']) {
      --work-panel-width: var(--expanded-work-panel-width);
      --file-preview-width: var(--expanded-file-preview-width);
      --work-panel-total-width: var(--expanded-panel-total);
    }

    @media (max-width: ${COMPACT_LAYOUT_WIDTH}px) {
      --work-panel-limit: max(0px, calc(100cqw - var(--chat-sidebar-width) - var(--chat-frame-gutter)));
    }
  `,
  content: css`
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  `,
  right: css`
    flex: none;
    width: calc(var(--work-panel-total-width) + 1px);
    min-width: 0;
    height: 100%;
    overflow: hidden;
    transition: width ${PANEL_TRANSITION};

    &[data-collapsed='true'] {
      width: 0;
    }
    &:has([data-resizing='true']) {
      transition: none;
    }
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `,
}))

type Props = {
  autoRenamingTopicId: string | null
  busy: boolean
  hasMessages: boolean
  messages: UIMessage[]
  left: ReactNode
  right: ReactNode
  terminal?: ReactNode
  topic: LocalChatTopic | null
  title: string
  children: ReactNode
  onAutoRenameTopic: (id: string) => void | Promise<void>
  onDeleteTopic: (id: string) => void | Promise<void>
  onFavoriteTopic: (id: string, favorite: boolean) => void | Promise<void>
  onRenameTopic: (id: string, title: string) => void | Promise<void>
}

const ChatLayout = memo<Props>(
  ({
    autoRenamingTopicId,
    busy,
    hasMessages,
    messages,
    left,
    right,
    terminal,
    topic,
    title,
    children,
    onAutoRenameTopic,
    onDeleteTopic,
    onFavoriteTopic,
    onRenameTopic,
  }) => {
    const sidebarCollapsed = useHomeStore((s) => s.sidebarCollapsed)
    const rightCollapsed = useChatUiStore((s) => s.rightCollapsed)
    const panelWidth = useWorkPanelLayoutStore((s) => s.panelWidth)
    const previewWidth = useWorkPanelLayoutStore((s) => s.previewWidth)
    const { handleResizeStart, isResizing, sidebarWidth } = useSidebarResize()

    return (
      <Flex
        className={[styles.container, 'size-full overflow-hidden bg-app-layout']}
        style={
          {
            '--chat-sidebar-width': `${sidebarCollapsed ? 0 : sidebarWidth}px`,
            '--chat-frame-gutter': `${sidebarCollapsed ? 19 : 11}px`,
            '--work-panel-preferred-width': `${panelWidth}px`,
            '--file-preview-preferred-width': `${previewWidth}px`,
          } as CSSProperties
        }
      >
        <div
          className={sidebarResizeStyles.sidebarWrapper}
          data-collapsed={sidebarCollapsed}
          data-resizing={isResizing}
          inert={sidebarCollapsed}
          style={
            {
              '--main-shell-sidebar-width': `${sidebarWidth}px`,
              width: sidebarCollapsed ? 0 : sidebarWidth,
            } as CSSProperties
          }
        >
          <Flex className='size-full flex-col overflow-hidden'>{left}</Flex>
        </div>
        <InsetContentFrame
          onResizeStart={sidebarCollapsed ? undefined : handleResizeStart}
          sidebarCollapsed={sidebarCollapsed}
        >
          <Flex className='h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
            <Flex className='min-h-0 min-w-0 flex-1 overflow-hidden'>
              <Flex className='flex-1 min-w-0 h-full flex-col'>
                <ChatHeader
                  autoRenameDisabled={busy || autoRenamingTopicId !== null}
                  autoRenaming={topic?.id === autoRenamingTopicId}
                  hasMessages={hasMessages}
                  messages={messages}
                  title={title}
                  topic={topic}
                  onAutoRename={onAutoRenameTopic}
                  onDelete={onDeleteTopic}
                  onFavorite={onFavoriteTopic}
                  onRename={onRenameTopic}
                />
                <div className={styles.content}>{children}</div>
              </Flex>
              <aside
                className={styles.right}
                data-collapsed={rightCollapsed}
                data-work-panel-shell
                inert={rightCollapsed}
              >
                {right}
              </aside>
            </Flex>
            {terminal}
          </Flex>
        </InsetContentFrame>
      </Flex>
    )
  }
)

ChatLayout.displayName = 'ChatLayout'

export default ChatLayout
