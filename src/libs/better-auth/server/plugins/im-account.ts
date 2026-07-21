import { generateCompactUuid } from '@pure/utils'
import debug from 'debug'

import { UserService } from '@/server/services/user'

const log = debug('auth:im')

function getImUserService() {
  return new UserService()
}

function resolveHookUserProfile(user: Record<string, unknown>) {
  const nick =
    (typeof user.name === 'string' ? user.name : '') ||
    (typeof user.username === 'string' ? user.username : '')
  const avatar =
    (typeof user.image === 'string' ? user.image : '') ||
    (typeof user.avatar === 'string' ? user.avatar : '')

  return { avatar, nick }
}

/** Better Auth 插件：在用户创建 / 会话创建时确保 IM 账号已导入 */
export const imAccountPlugin = () => ({
  id: 'im-account',
  init() {
    return {
      options: {
        databaseHooks: {
          user: {
            create: {
              before: async (user: Record<string, unknown>) => {
                log('user create before: authId=%s', user.id)

                const userId =
                  typeof user.userId === 'string' && user.userId.trim() !== ''
                    ? user.userId
                    : generateCompactUuid()

                return {
                  data: {
                    ...user,
                    userId,
                  },
                }
              },
              after: async (user: Record<string, unknown>) => {
                log('user create after: authId=%s userId=%s', user.id, user.userId)

                const authUserId = typeof user.id === 'string' ? user.id : ''
                if (!authUserId) {
                  throw new Error('Auth user ID is required for IM registration')
                }

                const profile = resolveHookUserProfile(user)
                const { status } = await getImUserService().ensureIMAccountForAuthUser(authUserId, profile)

                log('IM account ready via user.create: authId=%s status=%s', authUserId, status)
              },
            },
          },
          session: {
            create: {
              after: async (session: Record<string, unknown>) => {
                const authUserId = typeof session.userId === 'string' ? session.userId : ''
                if (!authUserId) return

                log('session create after: authId=%s', authUserId)

                const { status } = await getImUserService().ensureIMAccountForAuthUser(authUserId)
                log('IM account ready via session.create: authId=%s status=%s', authUserId, status)
              },
            },
          },
        },
      },
    }
  },
})
