'use client'

import type { ChatWebSearchToolResult } from '@pure/types'
import { createStaticStyles, cssVar } from 'antd-style'
import { getToolName, isToolUIPart } from 'ai'
import type { ToolUIPart, UIMessage } from 'ai'
import { CircleAlert, ExternalLink, Globe, Loader2 } from 'lucide-react'
import { memo } from 'react'

const styles = createStaticStyles(({ css }) => ({
  error: css`
    color: ${cssVar.colorWarningText};
    background: ${cssVar.colorWarningBg};
  `,
  icon: css`
    flex: none;
  `,
  link: css`
    display: flex;
    gap: 6px;
    align-items: center;

    min-width: 0;
    padding: 5px 8px;
    border-radius: 6px;

    color: ${cssVar.colorTextSecondary};
    text-decoration: none;

    &:hover {
      color: ${cssVar.colorPrimary};
      background: ${cssVar.colorFillSecondary};
    }
  `,
  linkIcon: css`
    flex: none;
    color: ${cssVar.colorTextQuaternary};
  `,
  linkTitle: css`
    overflow: hidden;
    min-width: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  list: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-block-start: 4px;
  `,
  panel: css`
    margin-block: 4px 10px;
    padding: 8px 10px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 10px;

    color: ${cssVar.colorTextSecondary};
    background: ${cssVar.colorFillQuaternary};
    font-size: 13px;
  `,
  summary: css`
    cursor: pointer;
    display: flex;
    gap: 7px;
    align-items: center;
    list-style: none;

    &::-webkit-details-marker {
      display: none;
    }
  `,
  spinner: css`
    animation: web-search-spin 1s linear infinite;

    @keyframes web-search-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
}))

type MessagePart = UIMessage['parts'][number]

const isWebSearchPart = (part: MessagePart): part is ToolUIPart =>
  isToolUIPart(part) && part.type !== 'dynamic-tool' && getToolName(part) === 'webSearch'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isWebSearchOutput = (value: unknown): value is ChatWebSearchToolResult => {
  if (!isRecord(value) || typeof value.query !== 'string' || typeof value.success !== 'boolean') return false
  if (!Array.isArray(value.results)) return false

  if (!value.success) return typeof value.error === 'string' && value.results.length === 0

  return value.results.every(
    (result) =>
      isRecord(result) &&
      typeof result.content === 'string' &&
      typeof result.title === 'string' &&
      typeof result.url === 'string' &&
      (result.publishedDate === undefined || typeof result.publishedDate === 'string')
  )
}

const safeHttpUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export const hasWebSearchToolPart = (message: UIMessage) => message.parts.some(isWebSearchPart)

export const getWebSearchStatusSignature = (message: UIMessage) =>
  message.parts
    .filter(isWebSearchPart)
    .map((part) => {
      if (part.state !== 'output-available') return part.state
      if (!isWebSearchOutput(part.output)) return 'invalid-output'
      return `${part.output.success}:${part.output.results.length}`
    })
    .join('|')

const WebSearchStatus = memo<{ message: UIMessage }>(({ message }) => {
  const parts = message.parts.filter(isWebSearchPart)

  if (parts.length === 0) return null

  return (
    <>
      {parts.map((part) => {
        if (part.state === 'input-streaming' || part.state === 'input-available') {
          return (
            <div className={styles.panel} key={part.toolCallId} role='status'>
              <div className={styles.summary}>
                <Loader2 className={`${styles.icon} ${styles.spinner}`} size={15} aria-hidden />
                <span>正在联网搜索…</span>
              </div>
            </div>
          )
        }

        if (part.state === 'output-error') {
          return (
            <div className={`${styles.panel} ${styles.error}`} key={part.toolCallId} role='status'>
              <div className={styles.summary}>
                <CircleAlert className={styles.icon} size={15} aria-hidden />
                <span>联网搜索失败，请稍后重试</span>
              </div>
            </div>
          )
        }

        if (part.state !== 'output-available') return null

        const output = isWebSearchOutput(part.output) ? part.output : null
        if (!output || !output.success) {
          return (
            <div className={`${styles.panel} ${styles.error}`} key={part.toolCallId} role='status'>
              <div className={styles.summary}>
                <CircleAlert className={styles.icon} size={15} aria-hidden />
                <span>{output?.error || '联网搜索失败，请稍后重试'}</span>
              </div>
            </div>
          )
        }

        if (output.results.length === 0) {
          return (
            <div className={styles.panel} key={part.toolCallId} role='status'>
              <div className={styles.summary}>
                <Globe className={styles.icon} size={15} aria-hidden />
                <span>未找到相关网页来源</span>
              </div>
            </div>
          )
        }

        return (
          <details className={styles.panel} key={part.toolCallId}>
            <summary className={styles.summary}>
              <Globe className={styles.icon} size={15} aria-hidden />
              <span>已搜索 {output.results.length} 个来源</span>
            </summary>
            <div className={styles.list}>
              {output.results.map((result, index) => {
                const href = safeHttpUrl(result.url)
                if (!href) return null

                return (
                  <a
                    className={styles.link}
                    href={href}
                    key={`${href}:${index}`}
                    rel='noreferrer noopener'
                    target='_blank'
                  >
                    <span className={styles.linkTitle}>{result.title}</span>
                    <ExternalLink className={styles.linkIcon} size={13} aria-hidden />
                  </a>
                )
              })}
            </div>
          </details>
        )
      })}
    </>
  )
})

WebSearchStatus.displayName = 'WebSearchStatus'

export default WebSearchStatus
