type BanState = {
  banExpires?: Date | null
  banned?: boolean | null
}

export function isUserCurrentlyBanned(user: BanState | null | undefined): boolean {
  if (user?.banned !== true) return false
  if (!(user.banExpires instanceof Date) || !Number.isFinite(user.banExpires.getTime())) return true
  return user.banExpires.getTime() > Date.now()
}
