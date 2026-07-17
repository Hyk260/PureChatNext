'use client'

import Link from '@/utils/link'
import { memo, useLayoutEffect } from 'react'

interface ErrorCaptureProps {
  error: Error
  reset: () => void
}

const ErrorCapture = memo<ErrorCaptureProps>(({ reset, error }) => {
  useLayoutEffect(() => {
    console.error(error)
  }, [error])

  return (
    <>
      <style>{`
        .error-page {
          align-items: center;
          background: #fff;
          color: #171717;
          display: flex;
          font-family: Arial, Helvetica, sans-serif;
          justify-content: center;
          min-height: 100svh;
          overflow: hidden;
          position: relative;
          width: 100%;
        }
        .error-page__bg {
          filter: blur(8px);
          font-size: min(240px, 25vw);
          font-weight: 900;
          left: 50%;
          line-height: 1;
          margin: 0;
          opacity: 0.12;
          pointer-events: none;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          user-select: none;
          z-index: 0;
        }
        .error-page__content {
          align-items: center;
          display: flex;
          flex-direction: column;
          position: relative;
          text-align: center;
          z-index: 1;
        }
        .error-page__title {
          font-size: 1.25rem;
          font-weight: 700;
          margin: 1rem 0 0;
        }
        .error-page__desc {
          margin: 0 0 2rem;
        }
        .error-page__actions {
          display: flex;
          gap: 12px;
        }
        .error-page__button,
        .error-page__link {
          border: 1px solid #e5e5ea;
          border-radius: 8px;
          cursor: pointer;
          display: inline-flex;
          font-size: 0.875rem;
          font-weight: 500;
          padding: 0.5rem 1rem;
          text-decoration: none;
        }
        .error-page__button {
          background: #fff;
          color: #171717;
        }
        .error-page__link {
          background: #007aff;
          border-color: #007aff;
          color: #fff;
        }
        @media (prefers-color-scheme: dark) {
          .error-page {
            background: #0a0a0a;
            color: #ededed;
          }
          .error-page__button {
            background: #1c1c1e;
            border-color: #3a3a3c;
            color: #ededed;
          }
          .error-page__link {
            background: #2e8dff;
            border-color: #2e8dff;
            color: #000;
          }
        }
      `}</style>
      <div className="error-page">
        <h1 aria-hidden className="error-page__bg">
          ERROR
        </h1>
        <div className="error-page__content">
          <div style={{ fontSize: '4rem', lineHeight: 1 }} aria-hidden>
            🤧
          </div>
          <h2 className="error-page__title">错误</h2>
          <p className="error-page__desc">页面遇到了问题，请稍后重试</p>
          <div className="error-page__actions">
            <button className="error-page__button" type="button" onClick={reset}>
              重试
            </button>
            <Link className="error-page__link" href="/">
              返回首页
            </Link>
          </div>
        </div>
      </div>
    </>
  )
})

ErrorCapture.displayName = 'ErrorCapture'

export default ErrorCapture
