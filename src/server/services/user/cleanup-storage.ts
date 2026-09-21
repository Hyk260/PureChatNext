import debug from 'debug'

import { FileModel } from '@pure/database/models/file'
import { UserModel } from '@pure/database/models/user'
import { avatarKeyPrefix } from '@/app/api/webapi/user/avatar/storage'
import { userSkillsPrefix } from '@/server/modules/GitHub/skillFiles'
import { deleteS3ObjectsByUrls, deleteS3Prefix } from '@/server/modules/S3/cleanup'
import { isS3Configured } from '@/server/modules/S3/config'

const log = debug('service:user')

export const USER_DELETED_S3_FAILED = '用户已删除，但对象存储清理失败，请检查 S3 配置后手动清理。'

export class UserStorageCleanupError extends Error {
  constructor(message = USER_DELETED_S3_FAILED) {
    super(message)
    this.name = 'UserStorageCleanupError'
  }
}

type OwnedStorageRef = {
  fileHash: string | null
  url: string
}

type UserStorageOwner = {
  authUserId: string
  businessUserId: string
}

export async function collectUserStorageRefs(authUserId: string) {
  return new FileModel(authUserId).listOwnedStorageRefs()
}

export async function cleanupUserS3Assets(owner: UserStorageOwner, fileRefs: OwnedStorageRef[]) {
  const fileModel = new FileModel(owner.authUserId)
  await fileModel.deleteOrphanGlobalFiles(fileRefs.map((ref) => ref.fileHash))

  if (!isS3Configured()) return

  const leftoverUrls: string[] = []
  const uniqueUrls = [...new Set(fileRefs.map((ref) => ref.url).filter(Boolean))]
  for (const url of uniqueUrls) {
    if (!(await fileModel.hasUrlReference(url))) leftoverUrls.push(url)
  }

  await deleteS3ObjectsByUrls(leftoverUrls)
  await deleteS3Prefix(avatarKeyPrefix(owner.businessUserId))
  await deleteS3Prefix(userSkillsPrefix(owner.authUserId))
}

export async function deleteAdminUserWithStorage(id: string, actorId: string) {
  const userModel = new UserModel()
  const user = await userModel.findById(id)
  if (!user) return { found: false as const }

  const fileRefs = await collectUserStorageRefs(user.id)
  const result = await userModel.deleteUserByIdForAdmin(id, actorId)
  if (!result.found) return result

  try {
    await cleanupUserS3Assets({ authUserId: user.id, businessUserId: user.userId }, fileRefs)
  } catch (error) {
    log('S3 cleanup failed after deleting user %s: %O', user.id, error)
    throw new UserStorageCleanupError()
  }

  return result
}
