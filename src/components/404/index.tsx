import Link from 'next/link'

import styles from './index.module.css'

const NotFound = () => {
  return (
    <div className={styles.notFoundPage}>
      <h1 aria-hidden className={styles.bg}>
        404
      </h1>
      <div className={styles.content}>
        <h2 className={styles.title}>404</h2>
        <p className={styles.desc}>
          页面不存在
          <br />
          请检查 URL 是否正确
        </p>
        <Link className={styles.link} href="/">
          返回首页
        </Link>
      </div>
    </div>
  )
}

export default NotFound
