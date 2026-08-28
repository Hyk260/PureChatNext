import { fileEnv } from '@/envs/file'

export const S3_REQUIRED_CONFIG_KEYS = [
  'S3_ACCESS_KEY_ID',
  'S3_BUCKET',
  'S3_ENDPOINT',
  'S3_SECRET_ACCESS_KEY',
] as const

type S3Configuration = Pick<typeof fileEnv, (typeof S3_REQUIRED_CONFIG_KEYS)[number]>

export const isS3Configured = (config: Partial<S3Configuration> = fileEnv) => {
  return S3_REQUIRED_CONFIG_KEYS.every((key) => Boolean(config[key]))
}
