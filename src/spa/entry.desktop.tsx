import '@/styles/globals.css'
import '@/styles/scrollbar.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'

import DesktopTitleBar, { DesktopTitleBarLayout } from '@/features/desktop/DesktopTitleBar'
import DesktopServerSetup from '@/spa/desktop/DesktopServerSetup'
import { webRoutes } from '@/spa/router/webRouter.config'
import { configureDesktopFetch } from '@/utils/desktopFetch'
import { createAppRouter } from '@/utils/router'

const rootEl = document.getElementById('root')

if (!rootEl) throw new Error('Root element #root not found')

const render = () => {
  const router = createAppRouter([
    {
      children: webRoutes,
      element: <DesktopTitleBarLayout />,
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
        <DesktopServerSetup />
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
