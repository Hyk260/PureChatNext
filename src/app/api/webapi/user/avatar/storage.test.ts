// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fileEnv = vi.hoisted(() => ({
  S3_BUCKET: 'pure-chat-next-1307934606',
  S3_ENABLE_PATH_STYLE: false,
  S3_ENDPOINT: 'https://cos.ap-shanghai.myqcloud.com',
  S3_PUBLIC_DOMAIN: undefined as string | undefined,
  S3_SET_ACL: false,
}))

vi.mock('@/envs/file', () => ({ fileEnv }))

import {
  avatarObjectKey,
  buildAvatarAccessUrl,
  currentAvatarFilename,
  extractOwnedAvatarKey,
  withAvatarCacheBust,
} from './storage'

describe('avatar storage urls', () => {
  beforeEach(() => {
    fileEnv.S3_PUBLIC_DOMAIN = undefined
    fileEnv.S3_SET_ACL = false
  })

  it('uses a same-origin proxy path when the bucket stays private', () => {
    expect(buildAvatarAccessUrl('huangyk', 'photo.jpg', avatarObjectKey('huangyk', 'photo.jpg'))).toBe(
      '/api/webapi/user/avatar/huangyk/photo.jpg'
    )
  })

  it('uses the custom domain when S3_PUBLIC_DOMAIN is set', () => {
    fileEnv.S3_PUBLIC_DOMAIN = 'https://cdn.purechat.cn'

    expect(buildAvatarAccessUrl('huangyk', 'photo.jpg', avatarObjectKey('huangyk', 'photo.jpg'))).toBe(
      'https://cdn.purechat.cn/user/avatar/huangyk/photo.jpg'
    )
  })

  it('uses a stable current filename', () => {
    expect(currentAvatarFilename('jpg')).toBe('avatar.jpg')
    expect(currentAvatarFilename('webp')).toBe('avatar.webp')
  })

  it('appends a cache-busting query', () => {
    expect(withAvatarCacheBust('/api/webapi/user/avatar/huangyk/avatar.jpg', 1700000000000)).toBe(
      '/api/webapi/user/avatar/huangyk/avatar.jpg?v=1700000000000'
    )
  })

  it('extracts keys from proxy, custom-domain, and virtual-hosted URLs', () => {
    const filename = currentAvatarFilename('jpg')
    const key = `user/avatar/huangyk/${filename}`
    const proxyPath = `/api/webapi/user/avatar/huangyk/${filename}`

    expect(extractOwnedAvatarKey(`http://localhost:5174${proxyPath}`, 'huangyk')).toBe(key)
    expect(extractOwnedAvatarKey(`${proxyPath}?v=1700000000000`, 'huangyk')).toBe(key)
    expect(extractOwnedAvatarKey(`https://cdn.purechat.cn/${key}?v=1700000000000`, 'huangyk')).toBe(key)
    expect(
      extractOwnedAvatarKey(`https://pure-chat-next-1307934606.cos.ap-shanghai.myqcloud.com/${key}`, 'huangyk')
    ).toBe(key)
  })

  it('ignores avatars that do not belong to the user', () => {
    expect(extractOwnedAvatarKey('https://avatars.githubusercontent.com/u/1', 'huangyk')).toBeUndefined()
    expect(extractOwnedAvatarKey('/api/webapi/user/avatar/other/photo.jpg', 'huangyk')).toBeUndefined()
  })
})
