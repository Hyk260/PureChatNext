'use client'

import { createContext, forwardRef, useContext } from 'react'
import type { ComponentPropsWithoutRef, ComponentRef } from 'react'
import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area'

import { cn } from './cn'
import { useShape } from './shapeContext'
import { useTouchPrimary } from './useTouchPrimary'

const ScrollAreaContext = createContext(false)

type Orientation = 'vertical' | 'horizontal' | 'both'

export interface ScrollAreaProps extends ComponentPropsWithoutRef<'div'> {
  orientation?: Orientation
  viewportClassName?: string
}

const TOUCH_OVERFLOW: Record<Orientation, string> = {
  both: 'overflow-auto',
  horizontal: 'overflow-x-auto',
  vertical: 'overflow-y-auto',
}

export const ScrollArea = forwardRef<ComponentRef<typeof ScrollAreaPrimitive.Root>, ScrollAreaProps>(
  ({ children, className, orientation = 'vertical', viewportClassName, ...props }, ref) => {
    const isTouch = useTouchPrimary()

    return (
      <ScrollAreaContext.Provider value={isTouch}>
        {isTouch ? (
          <div
            aria-roledescription='scroll area'
            className={cn('relative overflow-hidden', className)}
            data-slot='scroll-area'
            ref={ref}
            role='group'
            {...props}
          >
            <div
              className={cn('size-full rounded-[inherit]', TOUCH_OVERFLOW[orientation], viewportClassName)}
              data-slot='scroll-area-viewport'
              tabIndex={0}
            >
              {children}
            </div>
          </div>
        ) : (
          <ScrollAreaPrimitive.Root
            className={cn('relative overflow-hidden', className)}
            data-slot='scroll-area'
            ref={ref}
            {...props}
          >
            <ScrollAreaPrimitive.Viewport
              className={cn('size-full rounded-[inherit]', viewportClassName)}
              data-slot='scroll-area-viewport'
            >
              {/* Base UI defaults Content to minWidth: fit-content; vertical-only must not outgrow the viewport. */}
              <ScrollAreaPrimitive.Content style={orientation === 'vertical' ? { minWidth: 0 } : undefined}>
                {children}
              </ScrollAreaPrimitive.Content>
            </ScrollAreaPrimitive.Viewport>
            {orientation !== 'horizontal' && <ScrollBar orientation='vertical' />}
            {orientation !== 'vertical' && <ScrollBar orientation='horizontal' />}
            {orientation === 'both' && <ScrollAreaPrimitive.Corner />}
          </ScrollAreaPrimitive.Root>
        )}
      </ScrollAreaContext.Provider>
    )
  },
)

ScrollArea.displayName = 'ScrollArea'

export const ScrollBar = forwardRef<
  ComponentRef<typeof ScrollAreaPrimitive.Scrollbar>,
  ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Scrollbar>
>(({ className, orientation = 'vertical', ...props }, ref) => {
  const isTouch = useContext(ScrollAreaContext)
  const shape = useShape()

  if (isTouch) return null

  const isVertical = orientation === 'vertical'

  return (
    <ScrollAreaPrimitive.Scrollbar
      className={cn(
        'group/scrollbar absolute z-20 flex touch-none select-none',
        'opacity-0 transition-opacity duration-120 ease-out delay-160',
        'data-hovering:duration-160 data-scrolling:duration-160',
        'data-hovering:opacity-100 data-scrolling:opacity-100',
        'data-hovering:delay-0 data-scrolling:delay-0',
        isVertical ? 'top-0 right-0 h-full w-2.5' : 'bottom-0 left-0 h-2.5 w-full flex-col',
        className,
      )}
      data-slot='scroll-area-scrollbar'
      orientation={orientation}
      ref={ref}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        className={cn(
          'relative bg-[rgb(var(--overlay)/0.08)] transition-[background-color,width,height] duration-160 ease-in-out',
          'group-hover/scrollbar:bg-[rgb(var(--overlay)/0.12)] active:bg-[rgb(var(--overlay)/0.16)]!',
          shape.bg,
          isVertical
            ? 'mx-auto my-1 h-(--scroll-area-thumb-height) w-1 -translate-x-0.5 group-hover/scrollbar:w-1.5'
            : 'mx-1 my-auto h-1 w-(--scroll-area-thumb-width) -translate-y-0.5 group-hover/scrollbar:h-1.5',
        )}
        data-slot='scroll-area-thumb'
      />
    </ScrollAreaPrimitive.Scrollbar>
  )
})

ScrollBar.displayName = 'ScrollBar'
