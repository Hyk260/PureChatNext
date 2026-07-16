import '@/initialize'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'

import { webRoutes } from '@/spa/router/webRouter.config'
import { createAppRouter } from '@/utils/router'

import '@/styles/globals.css'
import '@/styles/scrollbar.css'

const router = createAppRouter(webRoutes)

const rootEl = document.getElementById('root')

if (!rootEl) {
  throw new Error('Root element #root not found')
}

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
