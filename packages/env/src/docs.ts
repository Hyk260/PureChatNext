import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import { nonEmptyEnv, optionalUrlEnv } from './helpers'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      /** 文档站 canonical 基址；备用域名部署时覆盖 `SITE_URL` 默认值。 */
      DOCS_SITE_URL?: string
      /** 百度站长平台校验码，输出到 `baidu-site-verification`。 */
      DOCS_BAIDU_VERIFICATION?: string
      /** Bing 站长平台校验码，输出到 `msvalidate.01`。 */
      DOCS_BING_VERIFICATION?: string
      /** Google Search Console 校验码，输出到 `google-site-verification`。 */
      DOCS_GOOGLE_VERIFICATION?: string
    }
  }
}

export const getDocsConfig = () => {
  return createEnv({
    server: {
      /** 文档站 canonical 基址；省略时使用 `lib/site.ts` 的默认值。 */
      DOCS_SITE_URL: optionalUrlEnv(),
      /** 百度站长平台校验码。 */
      DOCS_BAIDU_VERIFICATION: z.string().optional(),
      /** Bing 站长平台校验码。 */
      DOCS_BING_VERIFICATION: z.string().optional(),
      /** Google Search Console 校验码。 */
      DOCS_GOOGLE_VERIFICATION: z.string().optional(),
    },
    runtimeEnv: {
      DOCS_SITE_URL: nonEmptyEnv(process.env.DOCS_SITE_URL),
      DOCS_BAIDU_VERIFICATION: nonEmptyEnv(process.env.DOCS_BAIDU_VERIFICATION),
      DOCS_BING_VERIFICATION: nonEmptyEnv(process.env.DOCS_BING_VERIFICATION),
      DOCS_GOOGLE_VERIFICATION: nonEmptyEnv(process.env.DOCS_GOOGLE_VERIFICATION),
    },
  })
}

export const docsEnv = getDocsConfig()
