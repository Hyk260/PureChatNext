'use client'

import { lazy, memo, Suspense, useEffect } from 'react'
import type { ComponentType, ReactElement } from 'react'
import { createBrowserRouter, isRouteErrorResponse, Navigate, Outlet, useLocation, useRouteError } from 'react-router'
import type { RouteObject } from 'react-router'

import NotFound from '@/components/404'
import Loading from '@/components/Loading/BrandTextLoading'
import ErrorPage from '@/components/Error'
import { getPublicSpaRouteMetadata, PUBLIC_SPA_FILTER_PARAMS } from '@/const/publicSpaMetadata'
import AppLayer from '@/spa/AppLayer'

/** Loose component type so layout modules with required `children` stay assignable. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- route modules vary in props
type RouteComponent = ComponentType<any>

type RouteModule = { default: RouteComponent } | RouteComponent

async function importModule<T>(importFn: () => Promise<T>): Promise<T> {
  return importFn()
}

function resolveLazyModule(module: RouteModule): { default: RouteComponent } {
  if (module == null) {
    throw new Error('Dynamic import resolved to undefined. This usually means a chunk failed to load.')
  }
  if (typeof module === 'function') {
    return { default: module }
  }
  if ('default' in module) {
    return module as { default: RouteComponent }
  }
  return { default: module as RouteComponent }
}

/**
 * Lazy page element for router config (Suspense + BrandTextLoading).
 */
export function dynamicElement(importFn: () => Promise<RouteModule>, debugId?: string): ReactElement {
  const LazyComponent = lazy(async () => {
    const mod = await importModule(importFn)
    return resolveLazyModule(mod)
  })

  return (
    <Suspense fallback={<Loading debugId={debugId ?? 'Page'} />}>
      <LazyComponent />
    </Suspense>
  )
}

/**
 * Lazy layout element — renders `<Outlet />` as children for nested routes.
 */
export function dynamicLayout(importFn: () => Promise<RouteModule>, debugId?: string): ReactElement {
  const LazyComponent = lazy(async () => {
    const mod = await importModule(importFn)
    return resolveLazyModule(mod)
  })

  return (
    <Suspense fallback={<Loading debugId={debugId ?? 'Layout'} />}>
      <LazyComponent>
        <Outlet />
      </LazyComponent>
    </Suspense>
  )
}

export function redirectElement(to: string): ReactElement {
  return <Navigate replace to={to} />
}

function normalizeRouteError(error: unknown): Error {
  if (error instanceof Error) return error
  if (typeof error === 'string') return new Error(error)
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return new Error(error.message)
  }
  return new Error('Unknown route error')
}

/** Shared data-router fallback for render, loader, and action errors. */
export function RouterErrorElement(): ReactElement {
  const error = useRouteError()

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFound />
  }

  return <ErrorPage error={normalizeRouteError(error)} reset={() => window.location.reload()} />
}

export interface CreateAppRouterOptions {
  basename?: string
  syncPageTitle?: boolean
}

const SpaPageTitleSync = memo(() => {
  const location = useLocation()

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const hasFilters = PUBLIC_SPA_FILTER_PARAMS.some((key) => searchParams.has(key))

    document.title = getPublicSpaRouteMetadata(location.pathname, hasFilters).title
  }, [location.pathname, location.search])

  return null
})

SpaPageTitleSync.displayName = 'SpaPageTitleSync'

const RouterRoot = memo(({ syncPageTitle = false }: { syncPageTitle?: boolean }) => (
  <AppLayer>
    {syncPageTitle ? <SpaPageTitleSync /> : null}
    <Outlet />
  </AppLayer>
))

RouterRoot.displayName = 'RouterRoot'

/**
 * Data router with AppLayer (Theme / nuqs) inside RouterProvider context.
 * errorElement sits on a pathless child so RouterRoot (ThemeProviders) still wraps 404 / Error.
 */
export function createAppRouter(routes: RouteObject[], options?: CreateAppRouterOptions) {
  return createBrowserRouter(
    [
      {
        children: [
          {
            children: routes,
            errorElement: <RouterErrorElement />,
          },
        ],
        element: <RouterRoot syncPageTitle={options?.syncPageTitle} />,
        path: '/',
      },
    ],
    { basename: options?.basename }
  )
}
