'use client'

import { lazy, memo, Suspense } from 'react'
import type { ComponentType, ReactElement } from 'react'
import { createBrowserRouter, isRouteErrorResponse, Navigate, Outlet, useRouteError } from 'react-router'
import type { RouteObject } from 'react-router'

import NotFound from '@/components/404'
import Loading from '@/components/Loading/BrandTextLoading'
import ErrorPage from '@/components/Error'
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
}

const RouterRoot = memo(() => (
  <AppLayer>
    <Outlet />
  </AppLayer>
))

RouterRoot.displayName = 'RouterRoot'

/**
 * Data router with AppLayer (Theme / nuqs) inside RouterProvider context.
 */
export function createAppRouter(routes: RouteObject[], options?: CreateAppRouterOptions) {
  return createBrowserRouter(
    [
      {
        children: routes,
        errorElement: <RouterErrorElement />,
        element: <RouterRoot />,
        path: '/',
      },
    ],
    { basename: options?.basename }
  )
}
