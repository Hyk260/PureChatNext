/**
 * Vite-only shim: map Next App Router navigation APIs → react-router.
 * Aliased in vite.config.ts; Next builds keep using real `next/navigation`.
 */
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams as useRRParams,
  useSearchParams as useRRSearchParams,
} from 'react-router'

type NavigateOptions = {
  scroll?: boolean
}

function toHref(href: string | { pathname?: string; query?: Record<string, string>; hash?: string }) {
  if (typeof href === 'string') return href
  const qs = href.query ? `?${new URLSearchParams(href.query).toString()}` : ''
  return `${href.pathname ?? ''}${qs}${href.hash ?? ''}`
}

export function useRouter() {
  const navigate = useNavigate()

  return {
    back: () => navigate(-1),
    forward: () => navigate(1),
    prefetch: async (_href: string) => {},
    push: (
      href: string | { pathname?: string; query?: Record<string, string>; hash?: string },
      _opts?: NavigateOptions,
    ) => {
      navigate(toHref(href))
    },
    refresh: () => {
      window.location.reload()
    },
    replace: (
      href: string | { pathname?: string; query?: Record<string, string>; hash?: string },
      _opts?: NavigateOptions,
    ) => {
      navigate(toHref(href), { replace: true })
    },
  }
}

export function usePathname() {
  return useLocation().pathname
}

/** Next returns URLSearchParams; RR returns a tuple — unwrap for compatibility. */
export function useSearchParams() {
  const [searchParams] = useRRSearchParams()
  return searchParams
}

export function useParams<T extends Record<string, unknown> = Record<string, string | undefined>>() {
  return useRRParams() as T
}

export function redirect(url: string): never {
  throw new Response(null, {
    headers: { Location: url },
    status: 302,
  })
}

export function notFound(): never {
  throw new Response('Not Found', { status: 404, statusText: 'Not Found' })
}

/** No-op in SPA (Next layout CSS injection only). */
export function useServerInsertedHTML(_callback: () => unknown) {}

export { Navigate }
