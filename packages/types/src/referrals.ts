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
