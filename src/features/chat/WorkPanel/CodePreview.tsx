'use client'

import { loadCodeMirror, lobeTheme } from '@lobehub/editor/codemirror'
import type { ICodeMirrorInstance } from '@lobehub/editor/codemirror'
import { Button, Flexbox as Flex, Text, Tooltip, createStaticStyles, cssVar } from '@lobehub/ui'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useSystemAppearance } from '@/hooks/useSystemAppearance'
import { resolveThemeAppearance, useAppThemeMode } from '@/layout/themeMode'

import { detectFileIndent, getPreviewLanguage, getTextCursor } from './previewUtils'

// 编辑器由 CodeMirror 创建 DOM，需要通过其公开的 cm-* 类控制滚动、行号和主题。
const styles = createStaticStyles(({ css }) => ({
  editor: css`
    overflow: hidden;
    flex: 1;
    min-height: 0;
    .cm-editor {
      height: 100%;
      background: ${cssVar.colorBgContainer};
    }
    .cm-scroller {
      overflow: auto;
      font-size: 13px;
      line-height: 1.7;
    }
    .cm-content {
      padding-block: 12px;
    }
    .cm-line {
      padding-inline: 12px;
    }
    .cm-gutters {
      border-inline-end: 1px solid ${cssVar.colorBorderSecondary};
      color: ${cssVar.colorTextQuaternary};
      background: ${cssVar.colorBgContainer};
    }
    .cm-activeLineGutter {
      color: ${cssVar.colorText};
      background: transparent;
    }
    .cm-focused {
      outline: none;
    }
  `,
}))

// 当前 editor 包只声明 view 的主题 API；光标读数使用 CodeMirror 的实时选区。
type PreviewEditorView = ICodeMirrorInstance['view'] & {
  constructor: ICodeMirrorInstance['view']['constructor'] & {
    contentAttributes: { of: (attributes: Record<string, string>) => unknown }
  }
  state: {
    doc: { lineAt: (position: number) => { from: number; number: number } }
    selection: { main: { head: number } }
  }
}

function configureEditor(instance: ICodeMirrorInstance, isDark: boolean, filePath: string) {
  const view = instance.view as PreviewEditorView
  view.dispatch({
    effects: instance.optionHelper.theme.reconfigure([
      view.constructor.theme(lobeTheme, { dark: isDark }),
      view.constructor.contentAttributes.of({
        'aria-label': `${filePath} 文件内容`,
        'aria-readonly': 'true',
        tabindex: '0',
      }),
    ]),
  })
}

const CodePreview = memo(({ content, filePath }: { content: string; filePath: string }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const instanceRef = useRef<ICodeMirrorInstance | null>(null)
  const [cursor, setCursor] = useState({ column: 1, line: 1 })
  const [lineWrapping, setLineWrapping] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const language = useMemo(() => getPreviewLanguage(filePath), [filePath])
  const indent = useMemo(() => detectFileIndent(content), [content])
  const { themeMode } = useAppThemeMode()
  const systemAppearance = useSystemAppearance()
  const isDark = resolveThemeAppearance(themeMode, systemAppearance) === 'dark'
  const latestRef = useRef({ content, filePath, indent, language, isDark, lineWrapping })
  latestRef.current = { content, filePath, indent, language, isDark, lineWrapping }

  const syncCursor = useCallback(() => {
    const instance = instanceRef.current
    if (!instance) return
    const view = instance.view as PreviewEditorView
    const position = view.state.selection.main.head
    const line = view.state.doc.lineAt(position)
    setCursor({ column: position - line.from + 1, line: line.number })
  }, [])

  useEffect(() => {
    let disposed = false
    loadCodeMirror()
      .then((CodeMirror) => {
        if (disposed || !textareaRef.current) return
        const current = latestRef.current
        const instance = CodeMirror.fromTextArea(textareaRef.current, {
          foldGutter: true,
          indentWithTabs: current.indent.useTabs,
          lineNumbers: true,
          lineWrapping: current.lineWrapping,
          mode: current.language.mode,
          readOnly: true,
          tabSize: current.indent.size,
          value: current.content,
        })
        // 通过配置保留只读区域的焦点属性，避免后续编辑器更新清除 DOM 属性。
        configureEditor(instance, current.isDark, current.filePath)
        instanceRef.current = instance
      })
      .catch(() => {
        if (!disposed) setLoadError(true)
      })
    return () => {
      disposed = true
      instanceRef.current?.destroy()
      instanceRef.current = null
    }
  }, [])

  useEffect(() => {
    instanceRef.current?.setOption('lineWrapping', lineWrapping)
  }, [lineWrapping])

  useEffect(() => {
    const instance = instanceRef.current
    if (!instance) return
    configureEditor(instance, isDark, filePath)
  }, [filePath, isDark])

  return (
    <Flex className='h-full min-h-0' direction='vertical'>
      {loadError ? (
        <Text className='px-3 py-1' fontSize={12} type='secondary'>
          语法编辑器加载失败，已切换为文本预览
        </Text>
      ) : null}
      <div className={styles.editor} onFocusCapture={syncCursor} onKeyUp={syncCursor} onMouseUp={syncCursor}>
        <textarea
          aria-label={`${filePath} 文件内容`}
          className='size-full resize-none border-0 bg-transparent p-3 font-mono text-[13px] outline-none'
          defaultValue={content}
          readOnly
          ref={textareaRef}
          spellCheck={false}
          wrap={lineWrapping ? 'soft' : 'off'}
          onSelect={(event) => setCursor(getTextCursor(content, event.currentTarget.selectionStart))}
        />
      </div>
      <Flex
        horizontal
        className='flex-between shrink-0 flex-wrap gap-x-3 border-t border-app-border-secondary px-3 py-1'
      >
        <Text fontSize={11} type='secondary'>
          只读
        </Text>
        <Flex horizontal align='center' className='min-w-0 flex-wrap' gap={12}>
          <Text className='whitespace-nowrap' fontSize={11} type='secondary'>
            第 {cursor.line} 行，第 {cursor.column} 列
          </Text>
          <Text className='whitespace-nowrap' fontSize={11} type='secondary'>
            {indent.useTabs ? '制表符' : '空格'}：{indent.size}
          </Text>
          <Tooltip title='切换自动换行'>
            <Button
              aria-pressed={lineWrapping}
              size='small'
              type='text'
              onClick={() => setLineWrapping((current) => !current)}
            >
              <Text fontSize={11} type='secondary'>
                {lineWrapping ? '自动换行' : '不换行'}
              </Text>
            </Button>
          </Tooltip>
          <Text className='whitespace-nowrap' fontSize={11} type='secondary'>
            {language.label}
          </Text>
        </Flex>
      </Flex>
    </Flex>
  )
})

CodePreview.displayName = 'CodePreview'

export default CodePreview
