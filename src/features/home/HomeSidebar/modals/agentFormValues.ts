import type { AgentProfile } from '@/const/home/agents'

export type AgentFormValues = {
  avatar: string
  backgroundColor?: string
  description: string
  openingMessage: string
  openingQuestions: string[]
  systemRole: string
  title: string
}

const MIN_OPENING_QUESTION_COUNT = 3

export function padOpeningQuestions(questions?: string[] | null): string[] {
  const cleaned = (questions ?? []).map((question) => question.trim()).filter(Boolean)
  const missing = Math.max(0, MIN_OPENING_QUESTION_COUNT - cleaned.length)
  return [...cleaned, ...Array.from({ length: missing }, () => '')]
}

export function profileFormValues(profile: Partial<AgentProfile> = {}): AgentFormValues {
  return {
    avatar: profile.avatar || '🤖',
    backgroundColor: profile.backgroundColor ?? undefined,
    description: profile.description ?? '',
    openingMessage: profile.openingMessage ?? '',
    openingQuestions: padOpeningQuestions(profile.openingQuestions),
    systemRole: profile.systemRole ?? '',
    title: profile.title ?? '',
  }
}
