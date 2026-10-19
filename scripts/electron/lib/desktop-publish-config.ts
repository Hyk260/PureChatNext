import * as desktopModule from '../../../packages/env/src/desktop'
import * as fileModule from '../../../packages/env/src/file'

// env workspace 未声明 type:module，tsx/Node 使用 CJS，Vite 测试使用 ESM。
const desktopConfig = ('default' in desktopModule ? desktopModule.default : desktopModule) as typeof desktopModule
const fileConfig = ('default' in fileModule ? fileModule.default : fileModule) as typeof fileModule

export const DESKTOP_OBJECT_PREFIX = 'desktop/'

export function getDesktopPublishConfig() {
  const env = fileConfig.getFileConfig()
  const required = {
    S3_ACCESS_KEY_ID: env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: env.S3_SECRET_ACCESS_KEY,
    S3_BUCKET: env.S3_BUCKET,
    S3_ENDPOINT: env.S3_ENDPOINT,
    S3_REGION: env.S3_REGION,
  }
  for (const [name, value] of Object.entries(required)) {
    if (!value?.trim()) throw new Error(`桌面发布缺少 ${name}`)
  }

  const endpoint = new URL(env.S3_ENDPOINT!)
  const match = /^cos\.([a-z0-9-]+)\.myqcloud\.com$/.exec(endpoint.hostname)
  if (endpoint.protocol !== 'https:' || !match || endpoint.pathname !== '/') {
    throw new Error('桌面发布仅接受 HTTPS COS 地域 Endpoint，不能使用本地存储或 CDN Endpoint')
  }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('COS Endpoint 不能包含凭据、查询参数或片段')
  }
  if (env.S3_ENABLE_PATH_STYLE || env.S3_REGION !== match[1]) {
    throw new Error('COS 发布要求 S3_ENABLE_PATH_STYLE=0，且 S3_REGION 与 Endpoint 地域一致')
  }
  if (!/^[a-z0-9][a-z0-9-]*-\d+$/.test(env.S3_BUCKET!)) {
    throw new Error('S3_BUCKET 必须是包含 APPID 后缀的 COS 桶名')
  }

  const publicRoot = env.S3_PUBLIC_DOMAIN || `https://${env.S3_BUCKET}.${endpoint.host}`
  const expectedUrl = `${publicRoot.replace(/\/$/, '')}/${DESKTOP_OBJECT_PREFIX}`
  const updateUrl = desktopConfig.getDesktopUpdateConfig().PURECHAT_DESKTOP_UPDATE_URL || expectedUrl
  const publicUrl = new URL(updateUrl.endsWith('/') ? updateUrl : `${updateUrl}/`)
  if (
    publicUrl.protocol !== 'https:' ||
    publicUrl.username ||
    publicUrl.password ||
    publicUrl.search ||
    publicUrl.hash
  ) {
    throw new Error('正式更新地址必须是无凭据、查询参数和片段的 HTTPS URL')
  }
  if (publicUrl.pathname !== new URL(expectedUrl).pathname) {
    throw new Error('更新地址路径必须对应 S3_PUBLIC_DOMAIN 下的 desktop/，不能指向本地测试更新源')
  }

  return {
    bucket: env.S3_BUCKET!,
    updateUrl: publicUrl.href,
    setAcl: env.S3_SET_ACL,
    clientOptions: {
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
      endpoint: endpoint.href,
      region: env.S3_REGION!,
      forcePathStyle: false,
      // COS 不保证及时返回 100-continue；SDK 默认可能等到 requestTimeout 才开始发送大文件。
      expectContinueHeader: false,
      // 单次请求最多 15 分钟；外层发布重试负责重试，避免 SDK 内部重试把单步等待拉长。
      maxAttempts: 1,
      requestHandler: {
        connectionTimeout: 10_000,
        requestTimeout: 15 * 60_000,
        throwOnRequestTimeout: true,
        socketTimeout: 120_000,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED' as const,
      responseChecksumValidation: 'WHEN_REQUIRED' as const,
    },
  }
}

export type DesktopPublishConfig = ReturnType<typeof getDesktopPublishConfig>
