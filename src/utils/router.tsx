'use client'

import {
  type ComponentType,
  type ReactElement,
  lazy,
  memo,
  Suspense,
} from 'react'
import type { RouteObject } from 'react-router'
import { createBrowserRouter, Navigate, Outlet } from 'react-router'

import Loading from '@/components/Loading/BrandTextLoading'
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
    throw new Error(
      'Dynamic import resolved to undefined. This usually means a chunk failed to load.',
    )
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
export function dynamicElement(
  importFn: () => Promise<RouteModule>,
  debugId?: string,
): ReactElement {
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
export function dynamicLayout(
  importFn: () => Promise<RouteModule>,
  debugId?: string,
): ReactElement {
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
export function createAppRouter(
  routes: RouteObject[],
  options?: CreateAppRouterOptions,
) {
  return createBrowserRouter(
    [
      {
        children: routes,
        element: <RouterRoot />,
        path: '/',
      },
    ],
    { basename: options?.basename },
  )
}
