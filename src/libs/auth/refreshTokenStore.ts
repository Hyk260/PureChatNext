import { RefreshTokenFamilyModel } from '@pure/database/models/refreshTokenFamily'

import { signRefreshToken } from './jwt'

export const issueRefreshToken = async (userId: string) => {
  const refresh = await signRefreshToken(userId)
  await new RefreshTokenFamilyModel().create({
    expiresAt: refresh.expiresAt,
    familyId: refresh.family,
    tokenId: refresh.tokenId,
    userId,
  })
  return refresh
}
