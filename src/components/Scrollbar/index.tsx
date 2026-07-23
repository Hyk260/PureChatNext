'use client'

import { createStaticStyles, cssVar, cx } from 'antd-style'
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type UIEvent,
} from 'react'

const BAR_SIZE = 6
const BAR_GAP = 2

const styles = createStaticStyles(({ css }) => ({
  root: css`
    position: relative;
    height: 100%;
    overflow: hidden;

    &:hover .pure-scrollbar-bar,
    &.always .pure-scrollbar-bar {
      opacity: 1;
    }
  `,
  wrap: css`
    height: 100%;
    overflow: auto;

    &.hidden-native {
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }
    }
  `,
  view: css`
    min-height: 100%;
  `,
  bar: css`
    position: absolute;
    z-index: 1;
    right: ${BAR_GAP}px;
    bottom: ${BAR_GAP}px;
    border-radius: 4px;
    opacity: 0;
    transition: opacity 0.12s ease-out;

    &.vertical {
      top: ${BAR_GAP}px;
      width: ${BAR_SIZE}px;
    }

    &.horizontal {
      left: ${BAR_GAP}px;
      height: ${BAR_SIZE}px;
    }

    &.visible {
      opacity: 1;
    }
  `,
  thumb: css`
    position: absolute;
    display: block;
    cursor: pointer;
    border-radius: inherit;
    background: ${cssVar.colorTextQuaternary};
    transition: background-color 0.2s;
    opacity: 0.6;

    &:hover,
    &.dragging {
      background: ${cssVar.colorTextTertiary};
      opacity: 0.85;
    }

    &.vertical {
      width: 100%;
      right: 0;
    }

    &.horizontal {
      height: 100%;
      bottom: 0;
    }
  `,
}))

const toCssSize = (value?: string | number) => {
  if (value === undefined || value === '') return undefined
  return typeof value === 'number' ? `${value}px` : value
}

export interface ScrollbarProps {
  always?: boolean
  children?: ReactNode
  className?: string
  height?: string | number
  maxHeight?: string | number
  minSize?: number
  native?: boolean
  style?: CSSProperties
  viewClassName?: string
  viewStyle?: CSSProperties
  wrapClassName?: string
  wrapStyle?: CSSProperties
  onScroll?: (payload: { scrollTop: number; scrollLeft: number }) => void
}

export interface ScrollbarRef {
  scrollTo: {
    (options: ScrollToOptions): void
    (x: number, y?: number): void
  }
  setScrollLeft: (value: number) => void
  setScrollTop: (value: number) => void
  update: () => void
  wrapRef: HTMLDivElement | null
}

type Axis = 'vertical' | 'horizontal'

interface ThumbState {
  size: number
  move: number
  visible: boolean
}

const Scrollbar = memo(
  forwardRef<ScrollbarRef, ScrollbarProps>(
    (
      {
        always = false,
        children,
        className,
        height,
        maxHeight,
        minSize = 20,
        native = false,
        style,
        viewClassName,
        viewStyle,
        wrapClassName,
        wrapStyle,
        onScroll,
      },
      ref
    ) => {
      const rootRef = useRef<HTMLDivElement>(null)
      const wrapRef = useRef<HTMLDivElement>(null)
      const viewRef = useRef<HTMLDivElement>(null)

      const [vertical, setVertical] = useState<ThumbState>({ size: 0, move: 0, visible: false })
      const [horizontal, setHorizontal] = useState<ThumbState>({ size: 0, move: 0, visible: false })
      const [dragging, setDragging] = useState<Axis | null>(null)

      const dragRef = useRef<{ axis: Axis; startPage: number; startScroll: number } | null>(null)
      // 缓存上一次计算结果，仅在值真正变化时才 setState，避免高频 ResizeObserver 引发无谓重渲染
      const lastRef = useRef<{ v: ThumbState; h: ThumbState }>({
        v: { size: 0, move: 0, visible: false },
        h: { size: 0, move: 0, visible: false },
      })
      // rAF 节流句柄
      const rafRef = useRef<number | null>(null)

      const update = useCallback(() => {
        const wrap = wrapRef.current
        if (!wrap) return

        const { clientHeight, clientWidth, scrollHeight, scrollWidth, scrollTop, scrollLeft } = wrap
        const vRatio = clientHeight / scrollHeight || 1
        const hRatio = clientWidth / scrollWidth || 1

        const vTrack = Math.max(clientHeight - BAR_GAP * 2, 0)
        const hTrack = Math.max(clientWidth - BAR_GAP * 2, 0)
        const vSize = Math.max(vRatio * vTrack, vRatio < 1 ? minSize : 0)
        const hSize = Math.max(hRatio * hTrack, hRatio < 1 ? minSize : 0)

        const vMax = Math.max(scrollHeight - clientHeight, 0)
        const hMax = Math.max(scrollWidth - clientWidth, 0)
        const vMove = vMax > 0 ? (scrollTop / vMax) * Math.max(vTrack - vSize, 0) : 0
        const hMove = hMax > 0 ? (scrollLeft / hMax) * Math.max(hTrack - hSize, 0) : 0

        const vVisible = vRatio < 1
        const hVisible = hRatio < 1

        const last = lastRef.current
        if (last.v.size !== vSize || last.v.move !== vMove || last.v.visible !== vVisible) {
          last.v = { size: vSize, move: vMove, visible: vVisible }
          setVertical(last.v)
        }
        if (last.h.size !== hSize || last.h.move !== hMove || last.h.visible !== hVisible) {
          last.h = { size: hSize, move: hMove, visible: hVisible }
          setHorizontal(last.h)
        }
      }, [minSize])

      // 用 rAF 合并同一帧内多次触发，避免排版抖动期间高频 setState
      const scheduleUpdate = useCallback(() => {
        if (rafRef.current != null) return
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null
          update()
        })
      }, [update])

      const handleScroll = useCallback(
        (event: UIEvent<HTMLDivElement>) => {
          const target = event.currentTarget
          scheduleUpdate()
          onScroll?.({ scrollTop: target.scrollTop, scrollLeft: target.scrollLeft })
        },
        [onScroll, scheduleUpdate]
      )

      const setScrollTop = useCallback((value: number) => {
        if (wrapRef.current) wrapRef.current.scrollTop = value
      }, [])

      const setScrollLeft = useCallback((value: number) => {
        if (wrapRef.current) wrapRef.current.scrollLeft = value
      }, [])

      const scrollTo = useCallback(
        ((arg1: ScrollToOptions | number, arg2?: number) => {
          const wrap = wrapRef.current
          if (!wrap) return
          if (typeof arg1 === 'object') {
            wrap.scrollTo(arg1)
          } else {
            wrap.scrollTo(arg1, arg2 ?? 0)
          }
        }) as ScrollbarRef['scrollTo'],
        []
      )

      useImperativeHandle(
        ref,
        () => ({
          get wrapRef() {
            return wrapRef.current
          },
          update,
          scrollTo,
          setScrollTop,
          setScrollLeft,
        }),
        [scrollTo, setScrollLeft, setScrollTop, update]
      )

      useEffect(() => {
        update()

        const wrap = wrapRef.current
        const view = viewRef.current
        if (!wrap) return

        const observer = new ResizeObserver(() => scheduleUpdate())
        observer.observe(wrap)
        if (view) observer.observe(view)

        return () => {
          observer.disconnect()
          if (rafRef.current != null) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = null
          }
        }
      }, [update, scheduleUpdate])

      const onThumbMouseDown = useCallback(
        (axis: Axis) => (event: ReactMouseEvent<HTMLDivElement>) => {
          event.preventDefault()
          event.stopPropagation()

          const wrap = wrapRef.current
          if (!wrap) return

          dragRef.current = {
            axis,
            startPage: axis === 'vertical' ? event.clientY : event.clientX,
            startScroll: axis === 'vertical' ? wrap.scrollTop : wrap.scrollLeft,
          }
          setDragging(axis)
        },
        []
      )

      useEffect(() => {
        if (!dragging) return

        const onMove = (event: MouseEvent) => {
          const drag = dragRef.current
          const wrap = wrapRef.current
          if (!drag || !wrap) return

          const { clientHeight, clientWidth, scrollHeight, scrollWidth } = wrap
          if (drag.axis === 'vertical') {
            const track = Math.max(clientHeight - BAR_GAP * 2, 0)
            const thumb = vertical.size
            const offset = event.clientY - drag.startPage
            const maxScroll = Math.max(scrollHeight - clientHeight, 0)
            const maxMove = Math.max(track - thumb, 0)
            wrap.scrollTop = drag.startScroll + (maxMove > 0 ? (offset / maxMove) * maxScroll : 0)
          } else {
            const track = Math.max(clientWidth - BAR_GAP * 2, 0)
            const thumb = horizontal.size
            const offset = event.clientX - drag.startPage
            const maxScroll = Math.max(scrollWidth - clientWidth, 0)
            const maxMove = Math.max(track - thumb, 0)
            wrap.scrollLeft = drag.startScroll + (maxMove > 0 ? (offset / maxMove) * maxScroll : 0)
          }
        }

        const onUp = () => {
          dragRef.current = null
          setDragging(null)
        }

        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
        return () => {
          document.removeEventListener('mousemove', onMove)
          document.removeEventListener('mouseup', onUp)
        }
      }, [dragging, horizontal.size, vertical.size])

      const rootStyle: CSSProperties = {
        ...style,
        height: toCssSize(height) ?? style?.height,
        maxHeight: toCssSize(maxHeight) ?? style?.maxHeight,
      }

      // maxHeight/height 也下发到 wrap（真正的滚动容器）。wrap 默认 height:100%，
      // 当父级为 auto 高度时百分比高度回退为 auto，导致 max-height 无法约束滚动区；
      // 把 max-height 直接作用在 overflow:auto 的 wrap 上才能正确触发滚动。
      const wrapStyleMerged: CSSProperties = {
        ...(height !== undefined ? { height: toCssSize(height) } : {}),
        ...(maxHeight !== undefined ? { maxHeight: toCssSize(maxHeight) } : {}),
        ...wrapStyle,
      }

      const showCustomBar = !native

      return (
        <div ref={rootRef} className={cx(styles.root, always && 'always', className)} style={rootStyle}>
          <div
            ref={wrapRef}
            className={cx(styles.wrap, showCustomBar && 'hidden-native', wrapClassName)}
            style={wrapStyleMerged}
            onScroll={handleScroll}
          >
            <div ref={viewRef} className={cx(styles.view, viewClassName)} style={viewStyle}>
              {children}
            </div>
          </div>

          {showCustomBar && vertical.visible && (
            <div
              className={cx(
                styles.bar,
                'pure-scrollbar-bar',
                'vertical',
                (always || dragging === 'vertical') && 'visible'
              )}
            >
              <div
                className={cx(styles.thumb, 'vertical', dragging === 'vertical' && 'dragging')}
                style={{ height: vertical.size, transform: `translateY(${vertical.move}px)` }}
                onMouseDown={onThumbMouseDown('vertical')}
              />
            </div>
          )}

          {showCustomBar && horizontal.visible && (
            <div
              className={cx(
                styles.bar,
                'pure-scrollbar-bar',
                'horizontal',
                (always || dragging === 'horizontal') && 'visible'
              )}
            >
              <div
                className={cx(styles.thumb, 'horizontal', dragging === 'horizontal' && 'dragging')}
                style={{ width: horizontal.size, transform: `translateX(${horizontal.move}px)` }}
                onMouseDown={onThumbMouseDown('horizontal')}
              />
            </div>
          )}
        </div>
      )
    }
  )
)

Scrollbar.displayName = 'Scrollbar'

export default Scrollbar
