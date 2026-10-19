import { waitUntil } from '@vercel/functions'
import { LAST_ACTIVE_TOUCH_INTERVAL_MS, UserModel } from '@pure/database/models/user'
import type { UserDeviceInfo } from '@pure/database/schemas'
import debug from 'debug'

export { LAST_ACTIVE_TOUCH_INTERVAL_MS }

const log = debug('auth:last-active')

const lastTouchByUser = new Map<string, { deviceInfoKey?: string; touchedAt: number }>()

/** 测试用：清空进程内节流状态 */
export function resetTouchLastActiveForTests() {
  lastTouchByUser.clear()
}

/**
 * 节流触摸用户最近活跃时间。
 * 进程内 Map 跳过窗口内重复调度；写库由 UserModel 条件 UPDATE 再挡一层。
 */
export function touchUserLastActive(userId: string, deviceInfo?: UserDeviceInfo | null) {
  if (!userId) return

  const now = Date.now()
  const prev = lastTouchByUser.get(userId)
  const deviceInfoKey = deviceInfo ? JSON.stringify(deviceInfo) : undefined
  const deviceChanged = Boolean(deviceInfoKey && deviceInfoKey !== prev?.deviceInfoKey)
  if (prev && now - prev.touchedAt < LAST_ACTIVE_TOUCH_INTERVAL_MS && !deviceChanged) return

  lastTouchByUser.set(userId, {
    touchedAt: now,
    ...(deviceInfoKey ? { deviceInfoKey } : prev?.deviceInfoKey ? { deviceInfoKey: prev.deviceInfoKey } : {}),
  })

  const userModel = new UserModel()
  const touch = deviceInfo
    ? userModel.touchLastActiveAt(userId, new Date(now), deviceInfo)
    : userModel.touchLastActiveAt(userId)
  waitUntil(
    touch
      .catch((error: unknown) => {
        log('touch lastActiveAt failed userId=%s: %O', userId, error)
      })
  )
}
