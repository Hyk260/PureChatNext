import Link from 'next/link'

const NotFound = () => {
  return (
    <>
      <style>{`
        .not-found-page {
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
        .not-found-page__bg {
          filter: blur(8px);
          font-size: min(480px, 50vw);
          font-weight: 800;
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
        .not-found-page__content {
          align-items: center;
          display: flex;
          flex-direction: column;
          position: relative;
          text-align: center;
          z-index: 1;
        }
        .not-found-page__title {
          font-size: 1.25rem;
          font-weight: 700;
          margin: 0;
        }
        .not-found-page__desc {
          line-height: 1.8;
          margin: 1rem 0 2rem;
        }
        .not-found-page__link {
          background: #007aff;
          border-radius: 8px;
          color: #fff;
          display: inline-flex;
          font-size: 0.875rem;
          font-weight: 500;
          padding: 0.5rem 1rem;
          text-decoration: none;
        }
        @media (prefers-color-scheme: dark) {
          .not-found-page {
            background: #0a0a0a;
            color: #ededed;
          }
          .not-found-page__link {
            background: #2e8dff;
            color: #000;
          }
        }
      `}</style>
      <div className="not-found-page">
        <h1 aria-hidden className="not-found-page__bg">
          404
        </h1>
        <div className="not-found-page__content">
          <h2 className="not-found-page__title">404</h2>
          <p className="not-found-page__desc">
            页面不存在
            <br />
            请检查 URL 是否正确
          </p>
          <Link className="not-found-page__link" href="/">
            返回首页
          </Link>
        </div>
      </div>
    </>
  )
}

export default NotFound
