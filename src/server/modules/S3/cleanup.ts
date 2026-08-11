import debug from 'debug'

import { fileEnv } from '@/envs/file'
import { FileS3 } from '@/server/modules/S3'
import { extractS3KeyFromUrl } from '@/server/modules/S3/url'

const log = debug('file:s3-cleanup')

function isS3Configured() {
  return Boolean(fileEnv.S3_ACCESS_KEY_ID && fileEnv.S3_SECRET_ACCESS_KEY && fileEnv.S3_ENDPOINT && fileEnv.S3_BUCKET)
}

/** Delete S3 objects referenced by stored public URLs / keys. Throws when cleanup fails. */
export async function deleteS3ObjectsByUrls(urls: Array<string | null | undefined>) {
  const keys = [
    ...new Set(
      urls
        .filter((url): url is string => Boolean(url))
        .map((url) => extractS3KeyFromUrl(url))
        .filter(Boolean)
    ),
  ]
  if (keys.length === 0) return
  if (!isS3Configured()) throw new Error('S3 文件存储未配置，无法清理对象')

  try {
    await new FileS3().deleteFiles(keys)
  } catch (error) {
    log('清理 %d 个 S3 对象失败，keys=%O，原因=%O', keys.length, keys, error)
    throw error
  }
}
