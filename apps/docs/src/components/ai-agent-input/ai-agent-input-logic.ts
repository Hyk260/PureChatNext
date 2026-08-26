import type { AskAISkillId } from '@/lib/ask-ai-config'
import { MAX_ASK_AI_SKILLS } from '@/lib/ask-ai-config'

export type SlashToken = {
  end: number
  query: string
  start: number
}

export function findSlashToken(textBeforeCaret: string): SlashToken | null {
  const match = textBeforeCaret.match(/(?:^|\s)\/([^\s/]*)$/)
  if (!match) return null

  const query = match[1]
  return {
    end: textBeforeCaret.length,
    query,
    start: textBeforeCaret.length - query.length - 1,
  }
}

export function clipInsertedText(currentLength: number, insertion: string, maxLength: number) {
  return insertion.slice(0, Math.max(0, maxLength - currentLength))
}

export function isEditorVisuallyEmpty(text: string, skills: readonly AskAISkillId[]) {
  return text.trim().length === 0 && skills.length === 0
}

export function addUniqueSkill(current: readonly AskAISkillId[], skill: AskAISkillId) {
  if (current.includes(skill) || current.length >= MAX_ASK_AI_SKILLS) return [...current]
  return [...current, skill]
}
