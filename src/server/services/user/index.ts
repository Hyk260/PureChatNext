import debug from 'debug'

import { UserModel } from '@/database/models/user'
import {
  registerAccount,
  type RegisterAccountParams,
  type RegisterAccountResult,
} from '@/libs/utils/register'
import { FileS3 } from '@/server/modules/S3'

const log = debug('service:user')

type EnsureIMAccountProfile = {
  avatar?: string
  nick?: string
}

export class UserService {
  /**
   * 确保 IM 账号可用：已注册则跳过，未注册则导入。
   * 仅当返回成功时，调用方才可签发 userSig。
   */
  registerIMAccount = async (params: RegisterAccountParams): Promise<RegisterAccountResult> => {
    log('registerIMAccount: id=%s', params.id)
    return registerAccount(params)
  }

  /**
   * 通过 Better Auth 用户主键（users.id）确保 IM 账号已导入。
   * 用于 databaseHooks 与登录后会话创建等场景。
   */
  ensureIMAccountForAuthUser = async (
    authUserId: string,
    profile: EnsureIMAccountProfile = {},
  ): Promise<RegisterAccountResult> => {
    const user = await UserModel.findById(authUserId)
    if (!user?.userId) {
      throw new Error(`User ${authUserId} not found for IM registration`)
    }

    return this.registerIMAccount({
      id: user.userId,
      nick: profile.nick ?? user.username ?? '',
      avatar: profile.avatar ?? user.avatar ?? '',
    })
  }

  getUserAvatar = async (id: string, image: string) => {
    const s3 = new FileS3()
    const s3FileUrl = `user/avatar/${id}/${image}`

    try {
      const file = await s3.getFileByteArray(s3FileUrl)
      if (!file) {
        return null
      }
      return Buffer.from(file)
    } catch (error) {
      console.error('Failed to get user avatar', error)
    }
  }
}
