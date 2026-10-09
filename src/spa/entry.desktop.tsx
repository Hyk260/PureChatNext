import '@/styles/globals.css'
import '@/styles/scrollbar.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'

import DesktopTitleBar, { DesktopTitleBarLayout } from '@/features/desktop/DesktopTitleBar'
import DesktopLoginPage from '@/features/desktop/DesktopLoginPage'
import DesktopContentErrorBoundary from '@/features/desktop/DesktopContentErrorBoundary'
import DesktopErrorFrame from '@/features/desktop/DesktopErrorFrame'
import DesktopAuthGate from '@/spa/auth/DesktopAuthGate'
import DesktopLoginRoute from '@/routes/desktop-login/page'
import { webRoutes } from '@/spa/router/webRouter.config'
import { configureDesktopFetch } from '@/utils/desktopFetch'
import { createAppRouter, RouterErrorElement } from '@/utils/router'

const rootEl = document.getElementById('root')

if (!rootEl) throw new Error('Root element #root not found')

const render = () => {
  const router = createAppRouter([
    {
      children: [...webRoutes, { element: <DesktopLoginRoute />, path: 'desktop-login' }],
      errorElement: (
        <DesktopTitleBar>
          <DesktopErrorFrame>
            <RouterErrorElement />
          </DesktopErrorFrame>
        </DesktopTitleBar>
      ),
      element: (
        <DesktopAuthGate>
          <DesktopTitleBarLayout />
        </DesktopAuthGate>
      ),
    },
  ])
  createRoot(rootEl).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  )
}

const renderSetup = () => {
  createRoot(rootEl).render(
    <StrictMode>
      <DesktopTitleBar>
        <DesktopContentErrorBoundary>
          <DesktopLoginPage standalone />
        </DesktopContentErrorBoundary>
      </DesktopTitleBar>
    </StrictMode>
  )
}

configureDesktopFetch()
  .then((configured) => {
    if (configured) render()
    else renderSetup()
  })
  .catch((error) => {
    console.error('Failed to configure desktop API transport', error)
    renderSetup()
  })
