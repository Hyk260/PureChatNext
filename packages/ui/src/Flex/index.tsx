import { clsx } from 'clsx'
import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef } from 'react'

type FlexClassName = string | false | null | undefined | FlexClassName[]

export type FlexProps = Omit<ComponentPropsWithoutRef<'div'>, 'className'> & {
  className?: FlexClassName
}

/** A Tailwind-first flex container for business-layer layouts. */
export const Flex = forwardRef<HTMLDivElement, FlexProps>(({ className, ...props }, ref) => (
  <div ref={ref} {...props} className={clsx('flex', className)} />
))

Flex.displayName = 'Flex'
