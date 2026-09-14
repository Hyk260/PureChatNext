import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { UserModel } from '@pure/database/models/user'
import { withAuth } from '@/libs/auth/get-session-user'
import { FileS3 } from '@/server/modules/S3'
import { isS3Configured } from '@/server/modules/S3/config'
import { inferImageMimeTypeFromBytes } from '@pure/utils'

import {
  avatarKeyPrefix,
  avatarObjectKey,
  buildAvatarAccessUrl,
  currentAvatarFilename,
  extractOwnedAvatarKey,
  withAvatarCacheBust,
} from './storage'

const MAX_AVATAR_SIZE = 2 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/gif', 'image/jpeg', 'image/png', 'image/webp'])
const AVATAR_CACHE_CONTROL = 'public, max-age=0, must-revalidate'

const EXT_BY_TYPE: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

async function deleteAvatarKeys(fileS3: FileS3, keys: Iterable<string>) {
  const uniqueKeys = [...new Set(keys)].filter(Boolean)
  if (uniqueKeys.length === 0) return

  const results = await Promise.allSettled(uniqueKeys.map((key) => fileS3.deleteFile(key)))
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Failed to delete leftover avatar:', result.reason)
    }
  }
}

async function deleteLeftoverAvatars(fileS3: FileS3, userId: string, keepKey: string, previousAvatar?: string | null) {
  const keys = new Set<string>()
  const previousKey = extractOwnedAvatarKey(previousAvatar, userId)
  if (previousKey && previousKey !== keepKey) keys.add(previousKey)

  try {
    const files = await fileS3.listFiles(avatarKeyPrefix(userId))
    for (const file of files) {
      if (file.Key && file.Key !== keepKey) keys.add(file.Key)
    }
  } catch (error) {
    console.error('Failed to list previous avatars:', error)
  }

  await deleteAvatarKeys(fileS3, keys)
}

/**
 * 上传用户头像
 * POST /api/webapi/user/avatar
 */
export const POST = withAuth(async (req, { userId }) => {
  if (!isS3Configured()) {
    return NextResponse.json({ error: 'Avatar upload requires S3 configuration' }, { status: 503 })
  }

  const formData = await req.formData()
  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Missing or invalid file field' }, { status: 400 })
  }

  // 注意：不信任客户端声明的 file.type（可伪造，且为空串时会误伤合法图片）。
  // 统一以字节魔数检测结果为唯一权威，仅放行白名单内的真实图片格式。
  if (file.size > MAX_AVATAR_SIZE) {
    return NextResponse.json({ error: 'Image must be smaller than 2MB' }, { status: 400 })
  }

  const user = await UserModel.findById(userId)

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const detectedImageType = await inferImageMimeTypeFromBytes(buffer)
  // detectedImageType 仅在字节确认为 image/* 时非空（不会 fallback 到声明值），
  // 可执行文件 / HTML / 伪造魔数的内容在此直接拒绝。
  if (!detectedImageType || !ALLOWED_TYPES.has(detectedImageType)) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 })
  }

  const ext = EXT_BY_TYPE[detectedImageType] ?? 'png'
  const filename = currentAvatarFilename(ext)
  const s3Key = avatarObjectKey(user.userId, filename)

  try {
    const fileS3 = new FileS3()
    await fileS3.uploadBuffer(s3Key, buffer, detectedImageType, AVATAR_CACHE_CONTROL)

    const avatar = withAvatarCacheBust(buildAvatarAccessUrl(user.userId, filename, s3Key), Date.now())

    await auth.api.updateUser({
      body: { image: avatar },
      headers: req.headers,
    })

    try {
      await deleteLeftoverAvatars(fileS3, user.userId, s3Key, user.avatar)
    } catch (deleteError) {
      console.error('Failed to delete previous avatar:', deleteError)
    }

    return NextResponse.json({ avatar })
  } catch (error) {
    console.error('Avatar upload failed:', error)
    return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 })
  }
})
