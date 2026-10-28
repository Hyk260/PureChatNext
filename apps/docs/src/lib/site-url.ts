import { docsEnv } from '@pure/env/docs'
import { SITE_URL } from './site'

/** 文档站 canonical 基址；备用域名部署时用 `DOCS_SITE_URL` 覆盖默认值。 */
export const getSiteUrl = (): URL => new URL(docsEnv.DOCS_SITE_URL ?? SITE_URL)
