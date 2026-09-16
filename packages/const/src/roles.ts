export const USER_ROLE = {
  Admin: 'admin',
  User: 'user',
} as const

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE]

export function isAdminRole(role: string | null | undefined): boolean {
  return role === USER_ROLE.Admin
}
