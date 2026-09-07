'use client'

import { Button } from '@pure/ui'
import { memo, useLayoutEffect } from 'react'

import { StatusActions, StatusHomeButton, StatusPage } from '@/components/StatusPage'

interface ErrorCaptureProps {
  error: Error
  reset: () => void
}

const ErrorCapture = memo<ErrorCaptureProps>(({ reset, error }) => {
  useLayoutEffect(() => {
    console.error(error)
  }, [error])

  return (
    <StatusPage
      extra={
        <StatusActions>
          <Button onClick={reset}>重试</Button>
          <StatusHomeButton />
        </StatusActions>
      }
      status='error'
      subTitle='页面遇到了问题，请稍后重试'
      title='错误'
    />
  )
})

ErrorCapture.displayName = 'ErrorCapture'

export default ErrorCapture
