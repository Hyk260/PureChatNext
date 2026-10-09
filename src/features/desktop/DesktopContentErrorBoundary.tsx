import { Component } from 'react'
import type { PropsWithChildren } from 'react'

import ErrorPage from '@/components/Error'
import DesktopErrorFrame from '@/features/desktop/DesktopErrorFrame'

/** Keep startup content failures inside the desktop window chrome. */
class DesktopContentErrorBoundary extends Component<PropsWithChildren, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <DesktopErrorFrame>
          <ErrorPage error={this.state.error} reset={() => window.location.reload()} />
        </DesktopErrorFrame>
      )
    }

    return this.props.children
  }
}

export default DesktopContentErrorBoundary
