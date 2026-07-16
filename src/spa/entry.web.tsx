import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'

import AppLayer from '@/spa/AppLayer'

import '@/styles/globals.css'
import '@/styles/scrollbar.css'

/** Minimal placeholder until §1.3 webRouter.config 路由表落地 */
const router = createBrowserRouter([
  {
    path: '*',
    element: <div style={{ padding: 24 }}>PureChat SPA</div>,
  },
])

const rootEl = document.getElementById('root')

if (!rootEl) {
  throw new Error('Root element #root not found')
}

createRoot(rootEl).render(
  <StrictMode>
    <AppLayer>
      <RouterProvider router={router} />
    </AppLayer>
  </StrictMode>,
)
