/**
 * Vite-only shim for `next/link` → react-router `Link`.
 */
import { forwardRef } from 'react'
import type { AnchorHTMLAttributes, CSSProperties, MouseEvent, ReactNode } from 'react'
import { Link as RouterLink } from 'react-router'

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  children?: ReactNode
  className?: string
  href: string
  prefetch?: boolean
  replace?: boolean
  scroll?: boolean
  style?: CSSProperties
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, replace, prefetch: _prefetch, scroll: _scroll, ...rest },
  ref
) {
  return <RouterLink ref={ref} replace={replace} to={href} {...rest} />
})

export default Link
