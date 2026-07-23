/**
 * Vite-only shim for `next/link` → react-router `Link`.
 */
import { type AnchorHTMLAttributes, type CSSProperties, type MouseEvent, type ReactNode, forwardRef } from 'react'
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
