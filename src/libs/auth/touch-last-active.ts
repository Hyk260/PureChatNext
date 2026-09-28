import { waitUntil } from '@vercel/functions'
import { LAST_ACTIVE_TOUCH_INTERVAL_MS, UserModel } from '@pure/database/models/user'
import debug from 'debug'

export { LAST_ACTIVE_TOUCH_INTERVAL_MS }

const log = debug('auth:last-active')

const lastTouchByUser = new Map<string, number>()

/** 测试用：清空进程内节流状态 */
export function resetTouchLastActiveForTests() {
  lastTouchByUser.clear()
}

/**
 * 节流触摸用户最近活跃时间。
 * 进程内 Map 跳过窗口内重复调度；写库由 UserModel 条件 UPDATE 再挡一层。
 */
export function touchUserLastActive(userId: string) {
  if (!userId) return

  const now = Date.now()
  const prev = lastTouchByUser.get(userId)
  if (prev != null && now - prev < LAST_ACTIVE_TOUCH_INTERVAL_MS) return

  lastTouchByUser.set(userId, now)

  waitUntil(
    new UserModel()
      .touchLastActiveAt(userId)
      .catch((error: unknown) => {
        log('touch lastActiveAt failed userId=%s: %O', userId, error)
      })
  )
}
