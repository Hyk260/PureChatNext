/// <reference types="vite/client" />

import type {} from './types/spaServerConfig'

interface ImportMetaEnv {
  /** Force the SPA update toast in local/dev. Also: `?spaUpdatePreview=1`. */
  readonly VITE_SPA_UPDATE_PREVIEW?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
