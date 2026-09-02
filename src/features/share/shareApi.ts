import type { UIMessage } from 'ai'

import { apiFetch } from '@/utils/apiFetch'

export type PublicTopicShare = {
  agent: { avatar: string | null; title: string }
  messages: UIMessage[]
  shareId: string
  title: string
}

export const fetchPublicTopicShare = async (shareId: string): Promise<PublicTopicShare> => {
  const res = await apiFetch(`/api/share/t/${encodeURIComponent(shareId)}`)
  if (!res.ok) throw new Error(`fetchPublicTopicShare failed: ${res.status}`)

  return (await res.json()) as PublicTopicShare
}
