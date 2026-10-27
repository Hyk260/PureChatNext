import { getErrorMessage } from '@pure/utils/error'
import { ActionIcon, Button, Text, toast } from '@lobehub/ui'
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  RefreshCw,
  SquareDashedMousePointer,
  X,
} from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'

import { validateChatAttachments } from '@/features/chat/attachmentRules'
import { browserScreenshotFile, EMPTY_BROWSER_SELECTIONS, MAX_BROWSER_SELECTIONS } from '@/features/chat/browserContext'
import { useCurrentHomeModel } from '@/features/chat/ModelSwitchMenu'
import { getChatDraftKey, useChatDraftStore } from '@/features/chat/store/useChatDraftStore'
import { getDesktopApi } from '@/types/desktop'
import { normalizeBrowserUrl } from '@/utils/browserUrl'

import { useBrowserPanelStore } from './store'
import { useBrowserViewport } from './useBrowserViewport'
import BrowserAddressBar from './AddressBar'
import { useBrowserHistoryStore } from './history'

interface Props {
  instanceId: number
  contextKey: string
  historyScope: string
  agentId: string
  topicId: string | null
  busy: boolean
  visible: boolean
}

const BrowserPane = memo<Props>(({ contextKey, historyScope, instanceId, agentId, topicId, busy, visible }) => {
  const runtimeKey = JSON.stringify([contextKey, instanceId])
  const state = useBrowserPanelStore((store) => store.entries[contextKey]?.state)
  const [address, setAddress] = useState('')
  const [editing, setEditing] = useState(false)
  const [openingError, setOpeningError] = useState('')
  const [openingRevision, setOpeningRevision] = useState(0)
  const [capturing, setCapturing] = useState(false)
  const [picking, setPicking] = useState(false)
  const api = getDesktopApi()
  const model = useCurrentHomeModel()
  const latest = useRef({ vision: model.abilities?.vision, visible, busy })
  latest.current = { vision: model.abilities?.vision, visible, busy }
  const mounted = useRef(false)
  const viewport = useBrowserViewport(state?.sessionId, visible && !state?.error && state?.url !== 'about:blank')
  const draftKey = getChatDraftKey(agentId, topicId)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!api?.browser) return
    let cancelled = false
    const off = api.browser.onStateChange((next) => {
      if (next.contextKey === runtimeKey) useBrowserPanelStore.getState().update(contextKey, next, instanceId)
    })
    setOpeningError('')
    api.browser
      .open({ contextKey: runtimeKey })
      .then((next) => {
        const store = useBrowserPanelStore.getState()
        if (store.entries[contextKey]?.instanceId !== instanceId) {
          api.browser.close({ sessionId: next.sessionId }).catch(() => undefined)
        } else if (!cancelled) {
          store.update(contextKey, next, instanceId)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setOpeningError(getErrorMessage(error, '打开浏览器失败'))
      })
    return () => {
      cancelled = true
      off()
      const sessionId = useBrowserPanelStore.getState().entries[contextKey]?.state?.sessionId
      if (sessionId) api.browser.cancelPick({ sessionId }).catch(() => undefined)
    }
  }, [api, contextKey, instanceId, openingRevision, runtimeKey])

  useEffect(() => {
    if (!editing) setAddress(state?.url === 'about:blank' ? '' : (state?.url ?? ''))
  }, [editing, state?.url])

  useEffect(() => {
    if (state && !state.loading && !state.error) useBrowserHistoryStore.getState().remember(historyScope, state)
  }, [historyScope, state])

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action()
    } catch (error) {
      toast.error(getErrorMessage(error, '浏览器操作失败'))
    }
  }
  const focusInput = () => {
    if (mounted.current && latest.current.visible)
      window.dispatchEvent(new CustomEvent('purechat:focus-composer', { detail: draftKey }))
  }
  const capture = async () => {
    if (!state || !api || capturing || busy) return
    if (!latest.current.vision) {
      toast.error('当前模型不支持图片理解')
      return
    }
    setCapturing(true)
    try {
      const capture = await api.browser.capture({ sessionId: state.sessionId })
      if (useBrowserPanelStore.getState().entries[contextKey]?.state?.sessionId !== state.sessionId) return
      const file = browserScreenshotFile(capture)
      const drafts = useChatDraftStore.getState()
      const error = validateChatAttachments([file], drafts.files[draftKey]?.length ?? 0)
      if (error) throw new Error(error)
      if (!latest.current.vision) throw new Error('当前模型不支持图片理解')
      drafts.setFiles(draftKey, (files) => [...files, file])
      focusInput()
    } catch (error) {
      if (useBrowserPanelStore.getState().entries[contextKey]?.state?.sessionId === state.sessionId)
        toast.error(getErrorMessage(error, '截图失败'))
    } finally {
      if (mounted.current) setCapturing(false)
    }
  }
  const pick = async () => {
    if (!state || !api || busy) return
    if (picking) {
      await run(() => api.browser.cancelPick({ sessionId: state.sessionId }))
      return
    }
    setPicking(true)
    try {
      const element = await api.browser.pick({ sessionId: state.sessionId })
      if (!element || !mounted.current || !latest.current.visible) return
      if (useBrowserPanelStore.getState().entries[contextKey]?.state?.sessionId !== state.sessionId) return
      const drafts = useChatDraftStore.getState()
      const selections = drafts.browserSelections[draftKey] ?? EMPTY_BROWSER_SELECTIONS
      if (selections.length >= MAX_BROWSER_SELECTIONS) throw new Error(`最多添加 ${MAX_BROWSER_SELECTIONS} 个网页元素`)
      drafts.setBrowserSelections(draftKey, [...selections, { ...element, id: crypto.randomUUID() }])
      focusInput()
    } catch (error) {
      toast.error(getErrorMessage(error, '选择元素失败'))
    } finally {
      if (mounted.current) setPicking(false)
    }
  }

  if (!api?.browser)
    return (
      <div className='flex-col-center h-full gap-3 p-6 text-center'>
        <Globe aria-hidden size={32} />
        <Text>浏览器工具仅在桌面端可用</Text>
        <Text type='secondary'>请使用 PureChat 桌面端浏览网页、选择元素和添加截图。</Text>
      </div>
    )

  const error = openingError || state?.error
  const ready = Boolean(state && state.url !== 'about:blank' && !error)
  return (
    <div className='flex h-full min-h-0 flex-col' data-browser-panel>
      <div
        aria-label='浏览器工具栏'
        className='h-10 relative flex flex-none flex-wrap items-center gap-1 border-b border-app-border-secondary p-2'
        role='toolbar'
      >
        <ActionIcon
          aria-label='后退'
          disabled={!state?.canGoBack}
          icon={ChevronLeft}
          size='small'
          title='后退'
          onClick={() => state && run(() => api.browser.back(state))}
        />
        <ActionIcon
          aria-label='前进'
          disabled={!state?.canGoForward}
          icon={ChevronRight}
          size='small'
          title='前进'
          onClick={() => state && run(() => api.browser.forward(state))}
        />
        <ActionIcon
          aria-label={state?.loading ? '停止加载' : '刷新'}
          disabled={!state}
          icon={state?.loading ? X : RefreshCw}
          size='small'
          title={state?.loading ? '停止加载' : '刷新'}
          onClick={() => state && run(() => (state.loading ? api.browser.stop(state) : api.browser.reload(state)))}
        />
        <BrowserAddressBar
          disabled={!state}
          historyScope={historyScope}
          value={address}
          onChange={setAddress}
          onEditingChange={setEditing}
          onNavigate={(value) => {
            if (!state) return
            run(async () => {
              const url = normalizeBrowserUrl(value)
              setAddress(url)
              await api.browser.navigate({ sessionId: state.sessionId, url })
            })
          }}
        />
        <ActionIcon
          aria-label={picking ? '取消选择元素' : '框选页面元素'}
          active={picking}
          disabled={!ready || state?.loading || busy}
          icon={SquareDashedMousePointer}
          size='small'
          title={picking ? '取消选择元素' : '框选页面元素'}
          onClick={pick}
        />
        <ActionIcon
          aria-label='在系统浏览器中打开'
          disabled={!ready}
          icon={ExternalLink}
          size='small'
          title='在系统浏览器中打开'
          onClick={() => state && run(() => api.browser.openExternal(state))}
        />
        <ActionIcon
          aria-label='截图并添加到输入框'
          disabled={!ready || busy}
          icon={Camera}
          loading={capturing}
          size='small'
          title='截图并添加到输入框'
          onClick={capture}
        />
      </div>
      {state?.loading ? (
        <div aria-label='网页加载中' className='h-0.5 flex-none bg-primary' role='progressbar' />
      ) : null}
      <div className='relative min-h-0 flex-1' ref={viewport}>
        {error ? (
          <div className='flex-col-center h-full gap-3 p-5 text-center' role='alert'>
            <Text>{error}</Text>
            <Button
              onClick={() => (state ? run(() => api.browser.reload(state)) : setOpeningRevision((value) => value + 1))}
            >
              重试
            </Button>
          </div>
        ) : !state || state.url === 'about:blank' ? (
          <div className='flex-col-center h-full gap-3 p-5 text-center'>
            <Globe aria-hidden size={32} />
            <Text type='secondary'>在地址栏输入网址或搜索关键词</Text>
          </div>
        ) : null}
      </div>
    </div>
  )
})

BrowserPane.displayName = 'BrowserPane'
export default BrowserPane
