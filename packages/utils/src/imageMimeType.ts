import { fileTypeFromBuffer } from 'file-type'

/**
 * 规范化 MIME 类型：去除参数（如 ;charset=utf-8）、前后空白，并转为小写
 */
const normalizeMimeType = (mimeType: string | null | undefined): string => {
  return mimeType?.split(';')[0]?.trim().toLowerCase() ?? ''
}

/**
 * 统一输入为 Uint8Array（支持 ArrayBuffer / Uint8Array）
 */
const getBytes = (input: ArrayBuffer | Uint8Array): Uint8Array =>
  input instanceof Uint8Array ? input : new Uint8Array(input)

/**
 * 规范化 file-type 检测出的 MIME，空串回退为 undefined
 */
const normalizeDetectedMimeType = (mimeType: string | undefined): string | undefined => {
  const normalizedMimeType = normalizeMimeType(mimeType)
  return normalizedMimeType || undefined
}

/**
 * 规范化并校验是否为合法图片 MIME
 * - 非 image/* 返回 undefined
 * - 自动把常见别名 image/jpg 修正为 image/jpeg
 */
const normalizeDetectedImageMimeType = (mimeType: string | undefined): string | undefined => {
  const normalizedMimeType = normalizeDetectedMimeType(mimeType)
  if (!normalizedMimeType?.startsWith('image/')) return undefined
  return normalizedMimeType === 'image/jpg' ? 'image/jpeg' : normalizedMimeType
}

/**
 * 跨环境 Base64 头部解码：只取前 64 字符即可判断魔数，避免解码整个大文件
 * 同时兼容浏览器 atob 与 Node Buffer 两种环境
 */
const decodeBase64Header = (base64: string): Uint8Array | undefined => {
  const header = base64.replace(/\s/g, '').slice(0, 64)
  if (!header) return undefined

  try {
    let binary: string
    if (typeof atob === 'function') {
      // 浏览器 / Node 18+ 全局
      binary = atob(header)
    } else if (typeof Buffer !== 'undefined') {
      // 兜底：Node 旧版本无全局 atob
      binary = Buffer.from(header, 'base64').toString('binary')
    } else {
      return undefined
    }
    return Uint8Array.from(binary, (char) => char.charCodeAt(0))
  } catch {
    return undefined
  }
}

/**
 * 从字节推断任意文件的真实 MIME 类型
 */
export const inferMimeTypeFromBytes = async (input: ArrayBuffer | Uint8Array): Promise<string | undefined> => {
  const fileType = await fileTypeFromBuffer(getBytes(input))
  return normalizeDetectedMimeType(fileType?.mime)
}

/**
 * 从字节推断图片 MIME；非图片返回 undefined
 */
export const inferImageMimeTypeFromBytes = async (input: ArrayBuffer | Uint8Array): Promise<string | undefined> => {
  return normalizeDetectedImageMimeType(await inferMimeTypeFromBytes(input))
}

/**
 * 从 Base64 字符串头部推断图片 MIME；无需解码整个文件
 */
export const inferImageMimeTypeFromBase64 = async (base64: string | null | undefined): Promise<string | undefined> => {
  if (!base64) return undefined
  const bytes = decodeBase64Header(base64)
  if (!bytes) return undefined
  return inferImageMimeTypeFromBytes(bytes)
}

/**
 * 结合字节检测 + 声明值解析图片 MIME
 * - 优先使用字节级真实结果，失败时 fallback 到调用方传入的 declaredMimeType
 */
export const resolveImageMimeTypeFromBytes = async (
  declaredMimeType: string | null | undefined,
  input: ArrayBuffer | Uint8Array
): Promise<string | undefined> => {
  return (await inferImageMimeTypeFromBytes(input)) ?? normalizeDetectedImageMimeType(declaredMimeType ?? undefined)
}

/**
 * 结合 Base64 头部检测 + 声明值解析图片 MIME
 */
export const resolveImageMimeTypeFromBase64 = async (
  declaredMimeType: string | null | undefined,
  base64: string | null | undefined
): Promise<string | undefined> => {
  return (await inferImageMimeTypeFromBase64(base64)) ?? normalizeDetectedImageMimeType(declaredMimeType ?? undefined)
}

/**
 * 结合字节检测 + 声明值解析任意文件 MIME；最终兜底为 application/octet-stream
 */
export const resolveMimeTypeFromBytes = async (
  declaredMimeType: string | null | undefined,
  input: ArrayBuffer | Uint8Array
): Promise<string> => {
  const declared = normalizeMimeType(declaredMimeType)
  return (await inferMimeTypeFromBytes(input)) ?? (declared || 'application/octet-stream')
}
