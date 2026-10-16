import '@/initialize'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'

import { captureAcquisitionAttribution } from '@/libs/analytics/acquisition'
import { webRoutes } from '@/spa/router/webRouter.config'
import { createAppRouter } from '@/utils/router'

import '@/styles/globals.css'
import '@/styles/scrollbar.css'

const router = createAppRouter(webRoutes, { syncPageTitle: true })

const rootEl = document.getElementById('root')

if (!rootEl) {
  throw new Error('Root element #root not found')
}

captureAcquisitionAttribution(window.location, document.referrer)

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
