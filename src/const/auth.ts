import { isAdminRole } from '@pure/const'

export { isAdminRole, USER_ROLE } from '@pure/const'
export type { UserRole } from '@pure/const'

export function getUserRoleLabel(role: string | null | undefined): string {
  return isAdminRole(role) ? '管理员' : '普通用户'
}
