import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { appEnv } from '@/envs/app'
import { fileEnv } from '@/envs/file'
import { UserModel } from '@pure/database/models/user'
import { withAuth } from '@/libs/auth/get-session-user'
import { FileS3 } from '@/server/modules/S3'
import { isS3Configured } from '@/server/modules/S3/config'
import { buildPublicS3Url } from '@/server/modules/S3/url'

const MAX_AVATAR_SIZE = 2 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/gif', 'image/jpeg', 'image/png', 'image/webp'])

const EXT_BY_TYPE: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function avatarPrefix(userId: string) {
  return `user/avatar/${userId}/`
}

async function deletePreviousAvatars(fileS3: FileS3, userId: string, keepKey: string) {
  const files = await fileS3.listFiles(avatarPrefix(userId))
  const keysToDelete = files.map((file) => file.Key).filter((key) => key && key !== keepKey)

  if (keysToDelete.length === 0) {
    return
  }

  await fileS3.deleteFiles(keysToDelete)
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

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 })
  }

  if (file.size > MAX_AVATAR_SIZE) {
    return NextResponse.json({ error: 'Image must be smaller than 2MB' }, { status: 400 })
  }

  const user = await UserModel.findById(userId)

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const ext = EXT_BY_TYPE[file.type] ?? 'png'
  const filename = `${crypto.randomUUID()}.${ext}`
  const s3Key = `user/avatar/${user.userId}/${filename}`

  try {
    const fileS3 = new FileS3()
    const buffer = Buffer.from(await file.arrayBuffer())
    await fileS3.uploadBuffer(s3Key, buffer, file.type)

    const avatar = fileEnv.S3_SET_ACL
      ? buildPublicS3Url(s3Key)
      : `${appEnv.APP_URL ?? ''}/api/webapi/user/avatar/${user.userId}/${filename}`

    await auth.api.updateUser({
      body: { image: avatar },
      headers: req.headers,
    })

    try {
      await deletePreviousAvatars(fileS3, user.userId, s3Key)
    } catch (deleteError) {
      console.error('Failed to delete previous avatar:', deleteError)
    }

    return NextResponse.json({ avatar })
  } catch (error) {
    console.error('Avatar upload failed:', error)
    return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 })
  }
})
