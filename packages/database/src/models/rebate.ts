import { REFERRAL_INACTIVITY_MS } from '@pure/const'
import { createNanoId, getShanghaiBillingPeriod } from '@pure/utils'
import { eq } from 'drizzle-orm'

import { creditLedger, userRebates } from '../schemas/credits'
import type { Transaction } from '../type'

const ledgerId = createNanoId(21)

/** 调用方必须先锁定用户行；所有返利写入共享这一锁顺序。 */
export async function expireRebate(tx: Transaction, userId: string, now: Date) {
  const wallet = await tx.query.userRebates.findFirst({ where: eq(userRebates.userId, userId) })
  if (!wallet || wallet.expiresAt > now || wallet.balance === 0) return wallet
  await tx.update(userRebates).set({ balance: 0 }).where(eq(userRebates.userId, userId))
  await tx.insert(creditLedger).values({
    id: ledgerId(),
    userId,
    period: getShanghaiBillingPeriod(now),
    reason: 'referral_expire',
    credits: wallet.balance,
    delta: -wallet.balance,
    rebateCredits: wallet.balance,
    monthlyCredits: 0,
    createdAt: now,
  })
  return { ...wallet, balance: 0 }
}

export const rebateExpiry = (now: Date) => new Date(now.getTime() + REFERRAL_INACTIVITY_MS)
