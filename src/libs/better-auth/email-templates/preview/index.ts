export {
  EMAIL_TEMPLATE_CATALOG,
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_PREVIEW_MOCK,
  parseEmailTemplateKey,
  parseEmailTemplateParams,
  type EmailTemplateCatalogEntry,
  type EmailTemplateKey,
  type EmailTemplateParamField,
  type EmailTemplateParams,
  type EmailTemplatePreview,
  type RenderedEmailTemplate,
} from './preview-catalog'

/** Pure template renderers — safe in SPA (HTML via Vite raw plugin / Next raw-loader). */
export { getEmailTemplatePreviews, renderEmailTemplate } from './preview'
