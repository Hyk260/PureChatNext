declare const __PURECHAT_DESKTOP_CLOUD_URL__: string | undefined

const injectedCloudUrl =
  typeof __PURECHAT_DESKTOP_CLOUD_URL__ === 'string' ? __PURECHAT_DESKTOP_CLOUD_URL__.trim() : ''

export const DESKTOP_CLOUD_SERVER_URL =
  injectedCloudUrl || process.env.PURECHAT_DESKTOP_CLOUD_URL?.trim() || process.env.APP_URL?.trim() || null
