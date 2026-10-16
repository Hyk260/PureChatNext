/**
 * 仅供 Vite 使用的兼容层：将 Next App Router 导航 API 映射到 react-router。
 * 在 vite.config.ts 中配置别名；Next 构建仍使用真正的 `next/navigation`。
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
      _opts?: NavigateOptions
    ) => {
      navigate(toHref(href))
    },
    refresh: () => {
      window.location.reload()
    },
    replace: (
      href: string | { pathname?: string; query?: Record<string, string>; hash?: string },
      _opts?: NavigateOptions
    ) => {
      navigate(toHref(href), { replace: true })
    },
  }
}

export function usePathname() {
  return useLocation().pathname
}

/** Next 返回 URLSearchParams；RR 返回元组，这里解包以保持兼容。 */
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

/** 在 SPA 中不执行任何操作（Next 布局仅用它注入 CSS）。 */
export function useServerInsertedHTML(_callback: () => unknown) {}

export { Navigate }
