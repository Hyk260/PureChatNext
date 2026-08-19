import '@/styles/globals.css'
import '@/styles/scrollbar.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'

import { configureDesktopFetch } from '@/utils/desktopFetch'
import { webRoutes } from '@/spa/router/webRouter.config'
import { createAppRouter } from '@/utils/router'
import DesktopServerSetup from '@/spa/desktop/DesktopServerSetup'

const rootEl = document.getElementById('root')

if (!rootEl) throw new Error('Root element #root not found')

const render = () => {
  const router = createAppRouter(webRoutes)
  createRoot(rootEl).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  )
}

const renderSetup = () => {
  createRoot(rootEl).render(
    <StrictMode>
      <DesktopServerSetup />
    </StrictMode>
  )
}

void configureDesktopFetch()
  .then((configured) => {
    if (configured) render()
    else renderSetup()
  })
  .catch((error) => {
    console.error('Failed to configure desktop API transport', error)
    renderSetup()
  })
