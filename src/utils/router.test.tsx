import type { ReactElement, ReactNode } from 'react'

import { render, screen } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { webRoutes } from '@/spa/router/webRouter.config'

import { RouterErrorElement } from './router'

type LinkProps = { children?: ReactNode; href?: string; className?: string }

vi.mock('@/spa/AppLayer', () => ({
  default: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

vi.mock('next/link', () => ({
  default: ({ children, ...props }: LinkProps) => <a {...props}>{children}</a>,
}))

function renderDataRouter(routes: Parameters<typeof createMemoryRouter>[0], initialEntries = ['/']) {
  const router = createMemoryRouter(routes, { initialEntries })
  render(<RouterProvider router={router} />)
  return router
}

describe('RouterErrorElement', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it('renders the shared Error component for render errors', async () => {
    function BrokenPage(): ReactElement {
      throw new ReferenceError('formatActiveAt is not defined')
    }

    renderDataRouter([
      {
        element: <BrokenPage />,
        errorElement: <RouterErrorElement />,
        path: '/',
      },
    ])

    expect(await screen.findByText('错误')).toBeTruthy()
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy()
    expect(consoleError).toHaveBeenCalled()
  })

  it('renders the shared 404 component for route 404 responses', async () => {
    renderDataRouter([
      {
        element: <div>unreachable</div>,
        errorElement: <RouterErrorElement />,
        loader: () => {
          throw new Response('Not found', { status: 404 })
        },
        path: '/',
      },
    ])

    expect(await screen.findByText(/页面不存在/)).toBeTruthy()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('renders the shared 404 component for unmatched web routes', async () => {
    renderDataRouter(webRoutes, ['/settings/does-not-exist'])

    expect(await screen.findByText(/页面不存在/)).toBeTruthy()
  })
})
