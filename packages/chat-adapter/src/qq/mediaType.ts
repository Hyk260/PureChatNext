import type { RichMediaFileType } from './api'

/** 按 MIME / 扩展名映射 QQ 富媒体 file_type：1 图片 / 2 视频 / 3 音频 / 4 其它。 */
export function toQQMediaFileType(mimeType: string, fileName = ''): RichMediaFileType {
  if (mimeType.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp)$/i.test(fileName)) return 1
  if (mimeType.startsWith('video/') || /\.mp4$/i.test(fileName)) return 2
  if (mimeType.startsWith('audio/') || /\.(silk|wav|mp3|flac)$/i.test(fileName)) return 3
  return 4
}
