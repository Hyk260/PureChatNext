'use client'

import { createStaticStyles, cssVar } from 'antd-style'
import { X } from 'lucide-react'
import { memo } from 'react'

import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import { CONVERSATION_MAX_WIDTH } from '@/features/chat/WideScreenContainer'

interface ChatErrorBannerProps {
  message?: string
  onDismiss: () => void
}

// 保留 createStaticStyles：带主题色和焦点态的 Tailwind className 会超过 120 字符。
const styles = createStaticStyles(({ css }) => ({
  alert: css`
    box-sizing: border-box;
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
    gap: 12px;
    padding: 8px 12px;
    border: 1px solid ${cssVar.colorErrorBorder};
    border-radius: 16px;
    color: ${cssVar.colorError};
    background: ${cssVar.colorErrorBg};
    font-size: 13px;
    line-height: 1.5;
    overflow-wrap: break-word;
  `,
  closeButton: css`
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    margin: -4px;
    padding: 0;
    cursor: pointer;
    border: 0;
    border-radius: 6px;
    outline: none;
    color: ${cssVar.colorError};
    background: transparent;
    transition: opacity 0.15s ease;

    &:hover {
      opacity: 0.7;
    }

    &:focus-visible {
      box-shadow: 0 0 0 2px ${cssVar.colorError};
    }
  `,
}))

const ChatErrorBanner = memo<ChatErrorBannerProps>(({ message, onDismiss }) => {
  const wideScreen = useChatUiStore((state) => state.wideScreen)

  return (
    <div className='pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center'>
      <div
        className='pointer-events-auto box-border flex w-full max-w-full items-center justify-between gap-3 px-4'
        style={{ maxWidth: wideScreen ? undefined : `${CONVERSATION_MAX_WIDTH}px` }}
      >
        <div className={styles.alert} role='alert'>
          <span className='min-w-0'>{message || '发送失败，请稍后重试'}</span>
          <button
            aria-label='关闭错误提示'
            className={styles.closeButton}
            title='关闭'
            type='button'
            onClick={onDismiss}
          >
            <X aria-hidden size={16} />
          </button>
        </div>
      </div>
    </div>
  )
})

ChatErrorBanner.displayName = 'ChatErrorBanner'

export default ChatErrorBanner
