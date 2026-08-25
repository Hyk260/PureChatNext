import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

import { MessageItemType, MessageState, MessageType, WECHAT_RET_CODES } from './types'
import type {
  BaseInfo,
  CDNMedia,
  MessageItem,
  WechatGetConfigResponse,
  WechatGetUpdatesResponse,
  WechatSendMessageResponse,
} from './types'

/**
 * iLink CDN 媒体类型。
 * @see docs/self-hosting/channels/wechat/protocol.md §8.2
 */
export enum WechatUploadMediaType {
  IMAGE = 1,
  VIDEO = 2,
  FILE = 3,
  VOICE = 4,
}

/** 上传媒体到 iLink CDN 的结果。 */
export interface WechatUploadResult {
  /** AES 密钥的 Base64 编码 hex 字符串 — 出站 `media.aes_key` 所需格式。 */
  aesKey: string
  /** AES-128-ECB 密文大小（与 image_item / video_item 的 `mid_size` 一致）。 */
  cipherSize: number
  /** CDN 返回的 `encrypt_query_param`；填入出站 `media.encrypt_query_param`。 */
  encryptQueryParam: string
  /** 明文文件大小。 */
  rawSize: number
}

export const DEFAULT_BASE_URL = 'https://ilinkai.weixin.qq.com'
export const CDN_BASE_URL = 'https://novac2c.cdn.weixin.qq.com/c2c'

/** 去除尾部斜杠（不用正则，避免不可信输入触发 ReDoS）。 */
function stripTrailingSlashes(url: string): string {
  let end = url.length
  while (end > 0 && url[end - 1] === '/') end--
  return url.slice(0, end)
}

const CHANNEL_VERSION = '1.0.0'
const MAX_TEXT_LENGTH = 2000
const POLL_TIMEOUT_MS = 40_000
const DEFAULT_TIMEOUT_MS = 15_000

const BASE_INFO: BaseInfo = { channel_version: CHANNEL_VERSION }

/** 生成 iLink API 要求的随机 X-WECHAT-UIN 请求头值。 */
function randomUin(): string {
  const uint32 = Math.floor(Math.random() * 0xffff_ffff)
  return btoa(String(uint32))
}

function buildHeaders(botToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${botToken}`,
    AuthorizationType: 'ilink_bot_token',
    'Content-Type': 'application/json',
    'X-WECHAT-UIN': randomUin(),
  }
}

/**
 * 解析 JSON 响应。HTTP 错误或 ret 非零时抛出。
 * 与参考实现一致：仅当 ret 为数字且非 0 时才抛错。
 */
async function parseResponse<T>(response: Response, label: string): Promise<T> {
  const text = await response.text()
  const payload = text ? (JSON.parse(text) as T) : ({} as T)

  if (!response.ok) {
    const msg = (payload as { errmsg?: string } | null)?.errmsg ?? `${label} failed with HTTP ${response.status}`
    throw new Error(msg)
  }

  const ret = (payload as { ret?: number } | null)?.ret
  if (typeof ret === 'number' && ret !== WECHAT_RET_CODES.OK) {
    const body = payload as { errcode?: number; errmsg?: string; ret: number }
    throw Object.assign(new Error(body.errmsg ?? `${label} failed with ret=${ret}`), {
      code: body.errcode ?? ret,
    })
  }

  return payload
}

/** 合并可选外部 signal 与超时，生成组合 AbortSignal。 */
function combinedSignal(signal?: AbortSignal, timeoutMs: number = POLL_TIMEOUT_MS): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
}

export class WechatApiClient {
  private readonly botToken: string
  private readonly baseUrl: string
  botId: string

  constructor(botToken: string, botId?: string, baseUrl?: string) {
    this.botToken = botToken
    this.botId = botId || ''
    this.baseUrl = stripTrailingSlashes(baseUrl || DEFAULT_BASE_URL)
  }

  /**
   * 通过 iLink Bot API 长轮询新消息。
   * 服务端会保持连接约 35 秒。
   */
  async getUpdates(cursor?: string, signal?: AbortSignal, timeoutMs: number = POLL_TIMEOUT_MS): Promise<WechatGetUpdatesResponse> {
    const body = {
      base_info: BASE_INFO,
      get_updates_buf: cursor || '',
    }

    const response = await fetch(`${this.baseUrl}/ilink/bot/getupdates`, {
      body: JSON.stringify(body),
      headers: buildHeaders(this.botToken),
      method: 'POST',
      signal: combinedSignal(signal, timeoutMs),
    })

    return parseResponse<WechatGetUpdatesResponse>(response, 'getupdates')
  }

  /**
   * 通过 iLink Bot API 发送文本消息。
   * 参考实现：from_user_id 为空字符串，client_id 为随机 UUID。
   */
  async sendMessage(toUserId: string, text: string, contextToken: string): Promise<WechatSendMessageResponse> {
    const chunks = chunkText(text, MAX_TEXT_LENGTH)
    let lastResponse: WechatSendMessageResponse = { ret: 0 }

    for (const chunk of chunks) {
      lastResponse = await this.sendItem(
        toUserId,
        { text_item: { text: chunk }, type: MessageItemType.TEXT },
        contextToken
      )
    }

    return lastResponse
  }

  /**
   * 通过 iLink Bot API 发送单个 MessageItem（文本或媒体）。
   *
   * 按 protocol.md §6.7，稳定用法是每次请求一个 MessageItem —
   * 文本与媒体分开发送。调用方每次应生成新的 `client_id`；本方法内部会分配。
   */
  async sendItem(toUserId: string, item: MessageItem, contextToken: string): Promise<WechatSendMessageResponse> {
    const body = {
      base_info: BASE_INFO,
      msg: {
        client_id: crypto.randomUUID(),
        context_token: contextToken,
        from_user_id: '',
        item_list: [item],
        message_state: MessageState.FINISH,
        message_type: MessageType.BOT,
        to_user_id: toUserId,
      },
    }

    const response = await fetch(`${this.baseUrl}/ilink/bot/sendmessage`, {
      body: JSON.stringify(body),
      headers: buildHeaders(this.botToken),
      method: 'POST',
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    })

    return parseResponse<WechatSendMessageResponse>(response, 'sendmessage')
  }

  /**
   * 上传出站媒体到 iLink CDN。
   *
   * 实现 protocol.md §8.2 三步流程：
   *   1. `getuploadurl` — 携带媒体元数据与 AES 密钥请求 `upload_param`
   *   2. 本地 AES-128-ECB + PKCS7 加密
   *   3. POST 密文到 CDN；读取 `x-encrypted-param` 响应头
   *
   * 返回的 `aesKey` 为 hex 字符串的 base64（openclaw 出站 `media.aes_key` 格式，
   * 见 protocol.md §8.4 format B）。可直接填入
   * `image_item.media` / `file_item.media` / `video_item.media`。
   */
  async uploadCdnMedia(
    toUserId: string,
    mediaType: WechatUploadMediaType,
    plaintext: Buffer
  ): Promise<WechatUploadResult> {
    const aesKeyBuf = randomBytes(16)
    const aesKeyHex = aesKeyBuf.toString('hex')
    const filekey = randomBytes(16).toString('hex')
    const rawSize = plaintext.length
    const ciphertext = encryptAesEcb(plaintext, aesKeyBuf)
    const cipherSize = ciphertext.length
    const rawfilemd5 = createHash('md5').update(plaintext).digest('hex')

    // 步骤 1：请求 upload_param
    const uploadParamResp = await fetch(`${this.baseUrl}/ilink/bot/getuploadurl`, {
      body: JSON.stringify({
        aeskey: aesKeyHex,
        base_info: BASE_INFO,
        filekey,
        filesize: cipherSize,
        media_type: mediaType,
        no_need_thumb: true,
        rawfilemd5,
        rawsize: rawSize,
        to_user_id: toUserId,
      }),
      headers: buildHeaders(this.botToken),
      method: 'POST',
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    })

    const { upload_param: uploadParam } = await parseResponse<{ upload_param?: string }>(
      uploadParamResp,
      'getuploadurl'
    )
    if (!uploadParam) {
      throw new Error('getuploadurl returned empty upload_param')
    }

    // 步骤 2 + 3：上传密文到 CDN
    const cdnUrl = `${CDN_BASE_URL}/upload?encrypted_query_param=${encodeURIComponent(uploadParam)}&filekey=${filekey}`
    const cdnResp = await fetch(cdnUrl, {
      body: new Uint8Array(ciphertext),
      headers: { 'Content-Type': 'application/octet-stream' },
      method: 'POST',
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    })

    if (!cdnResp.ok) {
      const text = await cdnResp.text().catch(() => '')
      throw new Error(`CDN upload failed: ${cdnResp.status} ${text}`)
    }

    const encryptQueryParam = cdnResp.headers.get('x-encrypted-param')
    if (!encryptQueryParam) {
      throw new Error('CDN upload response missing x-encrypted-param header')
    }

    // 出站 media.aes_key 编码遵循 openclaw：32 字符 hex 字符串的 base64
    //（protocol.md §8.4 format B）。入站代码兼容两种格式。
    const aesKey = Buffer.from(aesKeyHex, 'ascii').toString('base64')

    return { aesKey, cipherSize, encryptQueryParam, rawSize }
  }

  /** 通过 iLink Bot API 发送正在输入指示。 */
  async sendTyping(toUserId: string, typingTicket: string, start = true): Promise<void> {
    await fetch(`${this.baseUrl}/ilink/bot/sendtyping`, {
      body: JSON.stringify({
        base_info: BASE_INFO,
        ilink_user_id: toUserId,
        status: start ? 1 : 2,
        typing_ticket: typingTicket,
      }),
      headers: buildHeaders(this.botToken),
      method: 'POST',
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    }).catch(() => {
      // 正在输入指示为尽力而为，失败可忽略
    })
  }

  /** 便捷方法：getConfig + sendTyping 一次调用。尽力而为，永不抛错。 */
  async startTyping(toUserId: string, contextToken: string): Promise<void> {
    try {
      const config = await this.getConfig(toUserId, contextToken)
      if (config.typing_ticket) {
        await this.sendTyping(toUserId, config.typing_ticket)
      }
    } catch {
      // 正在输入指示为尽力而为，失败可忽略
    }
  }

  /**
   * 从微信 CDN 下载并解密媒体。
   *
   * 流程见 protocol.md §8.3：
   *   GET CDN_BASE_URL/download?encrypted_query_param=... → AES-128-ECB 解密
   *
   * §8.5：缺少 AES 密钥时，尝试按明文下载。
   *
   * @param media  消息 item 中的 CDNMedia 引用
   * @param imageAeskey  可选，来自 image_item.aeskey 的 hex AES 密钥（优先）
   */
  async downloadCdnMedia(media: CDNMedia, imageAeskey?: string): Promise<Buffer> {
    if (!media.encrypt_query_param) {
      throw new Error('Missing encrypt_query_param in CDNMedia')
    }

    const url = `${CDN_BASE_URL}/download?encrypted_query_param=${encodeURIComponent(media.encrypt_query_param)}`
    const response = await fetch(url, {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    })

    if (!response.ok) {
      throw new Error(`CDN download failed: ${response.status} ${response.statusText}`)
    }

    const raw = Buffer.from(await response.arrayBuffer())

    // protocol.md §8.5：缺少 AES 密钥时按明文返回
    let key: Buffer
    try {
      key = resolveAesKey(imageAeskey, media.aes_key)
    } catch {
      // 无有效 AES 密钥 — 按规范返回明文
      return raw
    }
    return decryptAesEcb(raw, key)
  }

  /**
   * 获取 Bot 配置（含 typing_ticket）。
   * 参考实现要求传入 userId 与 contextToken。
   */
  async getConfig(userId: string, contextToken: string): Promise<WechatGetConfigResponse> {
    const response = await fetch(`${this.baseUrl}/ilink/bot/getconfig`, {
      body: JSON.stringify({
        base_info: BASE_INFO,
        context_token: contextToken,
        ilink_user_id: userId,
      }),
      headers: buildHeaders(this.botToken),
      method: 'POST',
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    })

    return parseResponse<WechatGetConfigResponse>(response, 'getconfig')
  }
}

// ============================================================================
// 二维码认证（无需鉴权的端点）
// ============================================================================

export interface QrCodeResponse {
  qrcode: string
  qrcode_img_content: string
}

export interface QrStatusResponse {
  baseurl?: string
  bot_token?: string
  ilink_bot_id?: string
  ilink_user_id?: string
  status: 'wait' | 'scaned' | 'confirmed' | 'expired'
}

/** 请求 Bot 登录用的新二维码。 */
export async function fetchQrCode(baseUrl: string = DEFAULT_BASE_URL): Promise<QrCodeResponse> {
  const url = `${stripTrailingSlashes(baseUrl)}/ilink/bot/get_bot_qrcode?bot_type=3`
  const response = await fetch(url, { method: 'GET' })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`iLink get_bot_qrcode failed: ${response.status} ${text}`)
  }

  return response.json() as Promise<QrCodeResponse>
}

/** 轮询二维码扫码状态。 */
export async function pollQrStatus(qrcode: string, baseUrl: string = DEFAULT_BASE_URL): Promise<QrStatusResponse> {
  const url = `${stripTrailingSlashes(baseUrl)}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`
  const response = await fetch(url, {
    headers: { 'iLink-App-ClientVersion': '1' },
    method: 'GET',
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`iLink get_qrcode_status failed: ${response.status} ${text}`)
  }

  return response.json() as Promise<QrStatusResponse>
}

// ============================================================================
// 工具函数
// ============================================================================

function chunkText(text: string, limit: number): string[] {
  if (text.length <= limit) return [text]

  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, limit))
    remaining = remaining.slice(limit)
  }
  return chunks
}

// ============================================================================
// CDN 媒体加解密（protocol.md §8.3–8.4）
// ============================================================================

/** AES-128-ECB 解密。 */
function decryptAesEcb(ciphertext: Buffer, key: Buffer): Buffer {
  const decipher = createDecipheriv('aes-128-ecb', key, null)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

/**
 * AES-128-ECB 加密（PKCS7 填充，Node createCipheriv 默认）。
 *
 * 用于出站媒体上传 — 见 {@link WechatApiClient.uploadCdnMedia}。
 */
function encryptAesEcb(plaintext: Buffer, key: Buffer): Buffer {
  const cipher = createCipheriv('aes-128-ecb', key, null)
  return Buffer.concat([cipher.update(plaintext), cipher.final()])
}

/**
 * 从两种来源与编码解析 16 字节 AES 密钥。
 *
 * 优先级见 protocol.md §8.4：
 *  1. `image_item.aeskey` — 32 字符 hex → hex 解码为 16 字节
 *  2. `media.aes_key` — base64 编码，两种可能格式：
 *     - Format A：base64(原始 16 字节) → 解码长度 = 16
 *     - Format B：base64(hex 字符串)   → 解码长度 = 32，再 hex 解码为 16
 */
export function resolveAesKey(imageAeskey?: string, mediaAesKey?: string): Buffer {
  // 优先级 1：image_item.aeskey（hex 字符串，32 字符）
  if (imageAeskey && /^[\da-f]{32}$/i.test(imageAeskey)) {
    return Buffer.from(imageAeskey, 'hex')
  }

  // 优先级 2：media.aes_key（base64 编码）
  if (mediaAesKey) {
    const decoded = Buffer.from(mediaAesKey, 'base64')

    if (decoded.length === 16) {
      return decoded // Format A：base64(原始 16 字节)
    }

    if (decoded.length === 32) {
      const hexStr = decoded.toString('ascii')
      if (/^[\da-f]{32}$/i.test(hexStr)) {
        return Buffer.from(hexStr, 'hex') // Format B：base64(hex 字符串)
      }
    }
  }

  throw new Error('No valid AES key found for CDN media decryption')
}
