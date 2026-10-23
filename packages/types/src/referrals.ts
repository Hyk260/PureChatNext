export type ReferralStatus = 'sending' | 'sent' | 'failed' | 'accepted' | 'expired'
export interface ReferralItem {
  id: string
  email: string
  status: ReferralStatus
  createdAt: string
  expiresAt: string
  acceptedAt: string | null
  link: string | null
  error: string | null
  canResend: boolean
}
export interface ReferralSendResult {
  email: string
  invitation?: ReferralItem
  error?: string
}
export interface ReferralBatchResponse {
  results: ReferralSendResult[]
}
export interface ReferralHistoryResponse {
  items: ReferralItem[]
  nextCursor: string | null
  totalSent: number
}
export interface PublicReferral {
  inviterName: string
  maskedEmail: string
  status: ReferralStatus
  expiresAt: string
}

export interface ReferralSummary {
  code: string
  link: string
  totalInvited: number
  totalRewarded: number
  totalEarned: number
  rebateRemaining: number
  rebateExpiresAt: string | null
}

export interface ReferralRewardRecord {
  id: string
  maskedEmail: string
  createdAt: string
  status: 'pending' | 'rewarded' | 'ineligible'
  amount: number
  rewardedAt: string | null
}

export interface ReferralRecordsResponse {
  items: ReferralRewardRecord[]
  hasMore: boolean
  page: number
}
