export type DiscoverAgentExample = {
  content: string
  role: 'assistant' | 'user'
}

type DetailExample = {
  content?: string
  role?: string
}

export type DetailAgent = {
  config?: {
    openingMessage?: string
    openingQuestions?: string[]
    systemRole?: string
  }
  examples?: DetailExample[]
  meta?: {
    avatar?: string
    backgroundColor?: string
    description?: string
    tags?: string[]
    title?: string
  }
  summary?: string
}

const isExampleRole = (role: string | undefined): role is 'assistant' | 'user' =>
  role === 'assistant' || role === 'user'

/** Map CDN detail payload into discover-agent fields. */
export function mapDetailToDiscoverFields(detail: DetailAgent): {
  backgroundColor?: string
  examples?: DiscoverAgentExample[]
  openingMessage?: string
  openingQuestions?: string[]
  summary?: string
  systemRole: string
  tags?: string[]
} {
  const systemRole = detail.config?.systemRole ?? ''
  const openingMessage = detail.config?.openingMessage?.trim() || undefined
  const openingQuestions = detail.config?.openingQuestions?.filter((q) => q.trim().length > 0)
  const summary = detail.summary?.trim() || undefined
  const tags = detail.meta?.tags?.filter((tag) => tag.trim().length > 0)
  const backgroundColor = detail.meta?.backgroundColor || undefined

  const examples = detail.examples
    ?.map((item): DiscoverAgentExample | null => {
      if (!isExampleRole(item.role) || typeof item.content !== 'string' || !item.content.trim()) {
        return null
      }
      return { content: item.content, role: item.role }
    })
    .filter((item): item is DiscoverAgentExample => item !== null)

  return {
    systemRole,
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(examples && examples.length > 0 ? { examples } : {}),
    ...(openingMessage ? { openingMessage } : {}),
    ...(openingQuestions && openingQuestions.length > 0 ? { openingQuestions } : {}),
    ...(summary ? { summary } : {}),
    ...(tags && tags.length > 0 ? { tags } : {}),
  }
}
