import { isAdminRole } from '@pure/const'

export { isAdminRole, USER_ROLE } from '@pure/const'
export type { UserRole } from '@pure/const'

/** 未验证邮箱账号保留时长（超过后由 cron 清理） */
export const UNVERIFIED_USER_TTL_MS = 24 * 60 * 60 * 1000

export function getUserRoleLabel(role: string | null | undefined): string {
  return isAdminRole(role) ? '管理员' : '普通用户'
}
