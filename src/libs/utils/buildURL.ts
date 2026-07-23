import { generateUserSig } from './signature'
import { imEnv } from '@/envs/im'

const { IM_SDK_APPID: sdkAppId, IM_ADMIN_ISTRATOR: administrator } = imEnv

let cachedSig = ''
let cacheExpiration = 0

interface URLParams {
  sdkappid: string
  identifier: string
  usersig: string
  random: number
  contenttype: string
}

export function generateRandomInt32(): number {
  return Math.floor(Math.random() * 0x100000000)
}

export function getUserSig(): string {
  const now = Date.now()
  if (cachedSig && cacheExpiration > now) {
    return cachedSig
  }
  cachedSig = generateUserSig({ identifier: administrator })
  cacheExpiration = now + 60 * 60 * 1000
  return cachedSig
}

export function buildURL(baseURL: string): string {
  if (!sdkAppId || !administrator) {
    throw new Error('sdkAppId or administrator is not defined')
  }

  const params: URLParams = {
    sdkappid: sdkAppId,
    identifier: administrator,
    usersig: getUserSig(),
    random: generateRandomInt32(),
    contenttype: 'json',
  }

  const encode = (value: string | number) => encodeURIComponent(value)
  const query = Object.entries(params)
    .map(([key, value]) => `${encode(key)}=${encode(value)}`)
    .join('&')

  return `${baseURL}?${query}`
}
