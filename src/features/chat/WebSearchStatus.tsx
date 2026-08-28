'use client'

import type { ChatWebSearchToolResult } from '@pure/types'
import { Avatar } from '@pure/ui'
import { isRecord } from '@pure/utils/object'
import { createStaticStyles, cssVar } from 'antd-style'
import { getToolName, isToolUIPart } from 'ai'
import type { ToolUIPart, UIMessage } from 'ai'
import { ChevronRight, CircleAlert, Globe, Loader2 } from 'lucide-react'
import { memo } from 'react'

const styles = createStaticStyles(({ css }) => ({
  avatars: css`
    display: flex;
    align-items: center;
    margin-inline-start: 2px;

    > * {
      margin-inline-start: -3px;
      border: 1px solid ${cssVar.colorBgContainer};
      border-radius: 50%;
    }
  `,
  card: css`
    display: flex;
    flex: none;
    flex-direction: column;
    justify-content: space-between;

    width: 160px;
    min-height: 80px;
    padding: 7px 8px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    color: ${cssVar.colorText};
    text-decoration: none;
    background: ${cssVar.colorBgContainer};

    &:hover {
      border-color: ${cssVar.colorPrimaryBorder};
      background: ${cssVar.colorFillQuaternary};
    }
  `,
  cardDomain: css`
    overflow: hidden;
    color: ${cssVar.colorTextQuaternary};
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  cardTitle: css`
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;

    font-size: 12px;
    line-height: 1.4;
    text-overflow: ellipsis;
  `,
  cards: css`
    overflow-x: auto;
    display: flex;
    gap: 12px;
    width: 100%;
    padding-block-end: 2px;
  `,
  chevron: css`
    flex: none;
    transition: transform 0.2s ${cssVar.motionEaseInOut};
  `,
  detail: css`
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    margin-block-start: 10px;
  `,
  error: css`
    color: ${cssVar.colorWarningText};
    background: ${cssVar.colorWarningBg};
  `,
  icon: css`
    flex: none;
  `,
  panel: css`
    width: fit-content;
    max-width: 100%;
    margin-block: 4px 10px;
    padding: 4px 8px;
    border-radius: 6px;

    color: ${cssVar.colorTextTertiary};
    font-size: 13px;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }

    &[open] {
      width: 100%;
      background: ${cssVar.colorFillQuaternary};
    }

    &[open] [data-chevron] {
      transform: rotate(90deg);
    }
  `,
  query: css`
    overflow: hidden;
    color: ${cssVar.colorTextSecondary};
    text-overflow: ellipsis;
    white-space: nowrap;
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

const getUrlMeta = (value: string) => {
  try {
    const url = new URL(value)
    const domain = url.hostname.replace(/^www\./u, '')
    return {
      domain,
      favicon: `https://icons.duckduckgo.com/ip3/${encodeURIComponent(url.hostname)}.ico`,
    }
  } catch {
    return { domain: value, favicon: '' }
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
              <span className={styles.avatars} aria-hidden>
                {output.results.slice(0, 6).map((result, index) => {
                  const href = safeHttpUrl(result.url)
                  if (!href) return null
                  const { favicon } = getUrlMeta(href)
                  return <Avatar avatar={favicon || '🌐'} key={`${href}:${index}`} size={16} />
                })}
              </span>
              <ChevronRight className={styles.chevron} data-chevron size={14} aria-hidden />
            </summary>
            <div className={styles.detail}>
              <div className={styles.query} title={output.query}>
                搜索：{output.query}
              </div>
              <div className={styles.cards}>
                {output.results.map((result, index) => {
                  const href = safeHttpUrl(result.url)
                  if (!href) return null
                  const { domain } = getUrlMeta(href)

                  return (
                    <a
                      className={styles.card}
                      href={href}
                      key={`${href}:${index}`}
                      rel='noreferrer noopener'
                      target='_blank'
                    >
                      <span className={styles.cardTitle}>{result.title}</span>
                      <span className={styles.cardDomain}>{domain}</span>
                    </a>
                  )
                })}
              </div>
            </div>
          </details>
        )
      })}
    </>
  )
})

WebSearchStatus.displayName = 'WebSearchStatus'

export default WebSearchStatus
