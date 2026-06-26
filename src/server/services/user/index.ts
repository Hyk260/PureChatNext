// import { UserModel } from '@/database/models/user'
import { FileS3 } from '@/server/modules/S3'

type CreatedUser = {
  createdAt?: Date | null
  email?: string | null
  firstName?: string | null
  id: string
  lastName?: string | null
  phone?: string | null
  username?: string | null
}

export class UserService {
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
