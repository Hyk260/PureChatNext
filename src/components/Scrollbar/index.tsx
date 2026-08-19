'use client'

import { createStaticStyles, cssVar, cx } from 'antd-style'
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode, UIEvent } from 'react'

const BAR_SIZE = 6
const BAR_GAP = 2
/** 亚像素取整可能导致 scrollHeight 比 clientHeight 大 1px，因此忽略这类误差。 */
const OVERFLOW_THRESHOLD = 1

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
    box-sizing: border-box;
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
  visible: boolean
}

interface AxisMetrics extends ThumbState {
  maxMove: number
  overflow: number
  trackSize: number
}

interface ScrollbarMetrics {
  horizontal: AxisMetrics
  vertical: AxisMetrics
}

interface DragState {
  axis: Axis
  startPage: number
  startScroll: number
}

const EMPTY_THUMB_STATE: ThumbState = {
  size: 0,
  visible: false,
}

const EMPTY_AXIS_METRICS: AxisMetrics = {
  maxMove: 0,
  overflow: 0,
  size: 0,
  trackSize: 0,
  visible: false,
}

const createEmptyMetrics = (): ScrollbarMetrics => ({
  horizontal: { ...EMPTY_AXIS_METRICS },
  vertical: { ...EMPTY_AXIS_METRICS },
})

const isSameThumbState = (previous: ThumbState, next: ThumbState) =>
  previous.size === next.size && previous.visible === next.visible

const calculateAxisMetrics = (viewportSize: number, contentSize: number, minSize: number): AxisMetrics => {
  const overflow = Math.max(contentSize - viewportSize, 0)
  const visible = overflow > OVERFLOW_THRESHOLD
  const trackSize = Math.max(viewportSize - BAR_GAP * 2, 0)
  const ratio = visible && contentSize > 0 ? viewportSize / contentSize : 1
  const size = Math.max(ratio * trackSize, visible ? minSize : 0)

  return {
    maxMove: Math.max(trackSize - size, 0),
    overflow,
    size,
    trackSize,
    visible,
  }
}

const getThumbOffset = (scrollOffset: number, metrics: AxisMetrics) => {
  if (!metrics.visible || metrics.overflow <= 0) return 0
  return (scrollOffset / metrics.overflow) * metrics.maxMove
}

const setThumbTransform = (thumb: HTMLDivElement | null, offset: number, axis: Axis) => {
  if (!thumb) return
  thumb.style.transform = axis === 'vertical' ? `translateY(${offset}px)` : `translateX(${offset}px)`
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
      const wrapRef = useRef<HTMLDivElement>(null)
      const viewRef = useRef<HTMLDivElement>(null)
      const verticalThumbRef = useRef<HTMLDivElement>(null)
      const horizontalThumbRef = useRef<HTMLDivElement>(null)
      const metricsRef = useRef<ScrollbarMetrics>(createEmptyMetrics())
      const dragRef = useRef<DragState | null>(null)
      const measureRafRef = useRef<number | null>(null)
      const positionRafRef = useRef<number | null>(null)

      const [vertical, setVertical] = useState<ThumbState>(EMPTY_THUMB_STATE)
      const [horizontal, setHorizontal] = useState<ThumbState>(EMPTY_THUMB_STATE)
      const [dragging, setDragging] = useState<Axis | null>(null)

      const syncThumbPositions = useCallback(() => {
        if (native) return

        const wrap = wrapRef.current
        const metrics = metricsRef.current
        if (!wrap) return

        setThumbTransform(verticalThumbRef.current, getThumbOffset(wrap.scrollTop, metrics.vertical), 'vertical')
        setThumbTransform(horizontalThumbRef.current, getThumbOffset(wrap.scrollLeft, metrics.horizontal), 'horizontal')
      }, [native])

      const schedulePositionSync = useCallback(() => {
        if (native || positionRafRef.current != null) return

        positionRafRef.current = requestAnimationFrame(() => {
          positionRafRef.current = null
          syncThumbPositions()
        })
      }, [native, syncThumbPositions])

      const measureScrollbars = useCallback(() => {
        if (native) return

        const wrap = wrapRef.current
        if (!wrap) return

        const nextMetrics: ScrollbarMetrics = {
          horizontal: calculateAxisMetrics(wrap.clientWidth, wrap.scrollWidth, minSize),
          vertical: calculateAxisMetrics(wrap.clientHeight, wrap.scrollHeight, minSize),
        }
        metricsRef.current = nextMetrics

        const nextHorizontal = {
          size: nextMetrics.horizontal.size,
          visible: nextMetrics.horizontal.visible,
        }
        const nextVertical = {
          size: nextMetrics.vertical.size,
          visible: nextMetrics.vertical.visible,
        }

        setHorizontal((previous) => (isSameThumbState(previous, nextHorizontal) ? previous : nextHorizontal))
        setVertical((previous) => (isSameThumbState(previous, nextVertical) ? previous : nextVertical))
        syncThumbPositions()
      }, [minSize, native, syncThumbPositions])

      const scheduleMeasure = useCallback(() => {
        if (native || measureRafRef.current != null) return

        measureRafRef.current = requestAnimationFrame(() => {
          measureRafRef.current = null
          measureScrollbars()
        })
      }, [measureScrollbars, native])

      const handleScroll = useCallback(
        (event: UIEvent<HTMLDivElement>) => {
          const target = event.currentTarget
          schedulePositionSync()
          onScroll?.({ scrollTop: target.scrollTop, scrollLeft: target.scrollLeft })
        },
        [onScroll, schedulePositionSync]
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
          update: measureScrollbars,
          scrollTo,
          setScrollLeft,
          setScrollTop,
        }),
        [measureScrollbars, scrollTo, setScrollLeft, setScrollTop]
      )

      useEffect(() => {
        if (native) {
          metricsRef.current = createEmptyMetrics()
          setHorizontal(EMPTY_THUMB_STATE)
          setVertical(EMPTY_THUMB_STATE)
          return
        }

        measureScrollbars()

        const wrap = wrapRef.current
        const view = viewRef.current
        if (!wrap) return

        const observer = new ResizeObserver(scheduleMeasure)
        observer.observe(wrap)
        if (view) observer.observe(view)

        return () => {
          observer.disconnect()
          if (measureRafRef.current != null) {
            cancelAnimationFrame(measureRafRef.current)
            measureRafRef.current = null
          }
          if (positionRafRef.current != null) {
            cancelAnimationFrame(positionRafRef.current)
            positionRafRef.current = null
          }
        }
      }, [measureScrollbars, native, scheduleMeasure])

      useLayoutEffect(() => {
        syncThumbPositions()
      }, [horizontal.size, horizontal.visible, syncThumbPositions, vertical.size, vertical.visible])

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

          const metrics = drag.axis === 'vertical' ? metricsRef.current.vertical : metricsRef.current.horizontal
          const pageOffset = (drag.axis === 'vertical' ? event.clientY : event.clientX) - drag.startPage
          const nextScroll =
            drag.startScroll + (metrics.maxMove > 0 ? (pageOffset / metrics.maxMove) * metrics.overflow : 0)

          if (drag.axis === 'vertical') {
            wrap.scrollTop = nextScroll
          } else {
            wrap.scrollLeft = nextScroll
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
      }, [dragging])

      const rootStyle: CSSProperties = {
        ...style,
        height: toCssSize(height) ?? style?.height,
        maxHeight: toCssSize(maxHeight) ?? style?.maxHeight,
      }

      // 高度约束必须同时作用于真正的滚动容器，否则 auto 高度父级中的 100% 高度无法触发滚动。
      const wrapStyleMerged: CSSProperties = {
        ...(height !== undefined ? { height: toCssSize(height) } : {}),
        ...(maxHeight !== undefined ? { maxHeight: toCssSize(maxHeight) } : {}),
        ...wrapStyle,
      }

      const showCustomBar = !native

      return (
        <div className={cx(styles.root, always && 'always', className)} style={rootStyle}>
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
                ref={verticalThumbRef}
                className={cx(styles.thumb, 'vertical', dragging === 'vertical' && 'dragging')}
                style={{ height: vertical.size }}
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
                ref={horizontalThumbRef}
                className={cx(styles.thumb, 'horizontal', dragging === 'horizontal' && 'dragging')}
                style={{ width: horizontal.size }}
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
