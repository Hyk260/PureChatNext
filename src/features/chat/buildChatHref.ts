export const buildChatHref = (agentId: string, topicId?: string | null) => {
  const params = new URLSearchParams({ agent: agentId })
  if (topicId) params.set('topic', topicId)
  return `/chat?${params.toString()}`
}
