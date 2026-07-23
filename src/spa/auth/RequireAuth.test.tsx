import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'

vi.mock('antd', () => ({
  Skeleton: () => <div data-testid="auth-skeleton" />,
  Flex: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/libs/better-auth/client', () => ({
  useSession: vi.fn(),
}))

import { useSession } from '@/libs/better-auth/client'
import RequireAuth from '@/spa/auth/RequireAuth'

const mockedUseSession = vi.mocked(useSession)

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          element={
            <RequireAuth>
              <div>chat-ok</div>
            </RequireAuth>
          }
          path="/chat"
        />
        <Route element={<div>signin-page</div>} path="/signin" />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireAuth', () => {
  beforeEach(() => {
    mockedUseSession.mockReset()
  })

  it('shows fallback while session is pending', () => {
    mockedUseSession.mockReturnValue({
      data: null,
      isPending: true,
    } as ReturnType<typeof useSession>)

    renderAt('/chat')
    expect(screen.getByTestId('auth-skeleton')).toBeTruthy()
    expect(screen.queryByText('chat-ok')).toBeNull()
  })

  it('redirects unauthenticated users to signin with callbackUrl', () => {
    mockedUseSession.mockReturnValue({
      data: null,
      isPending: false,
    } as ReturnType<typeof useSession>)

    renderAt('/chat')
    expect(screen.getByText('signin-page')).toBeTruthy()
  })

  it('renders children when session has a user', () => {
    mockedUseSession.mockReturnValue({
      data: { user: { id: 'u1' } },
      isPending: false,
    } as ReturnType<typeof useSession>)

    renderAt('/chat')
    expect(screen.getByText('chat-ok')).toBeTruthy()
  })
})
