import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef } from 'react'

type FlexClassName = string | false | null | undefined | FlexClassName[]

export type FlexProps = Omit<ComponentPropsWithoutRef<'div'>, 'className'> & {
  className?: FlexClassName
}

const mergeClassNames = (...values: FlexClassName[]) => {
  const classNames: string[] = []

  const append = (value: FlexClassName) => {
    if (!value) return
    if (Array.isArray(value)) {
      value.forEach(append)
      return
    }
    classNames.push(value)
  }

  values.forEach(append)
  return classNames.join(' ')
}

/** A Tailwind-first flex container for business-layer layouts. */
export const Flex = forwardRef<HTMLDivElement, FlexProps>(({ className, ...props }, ref) => (
  <div ref={ref} {...props} className={mergeClassNames('flex', className)} />
))

Flex.displayName = 'Flex'
