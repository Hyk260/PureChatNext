export const ASK_AI_MODEL_IDS = [
  'openai/gpt-5.4-mini',
  'openai/gpt-5.2',
  'alibaba/qwen3.5-plus',
] as const

export type AskAIModelId = (typeof ASK_AI_MODEL_IDS)[number]

export const DEFAULT_ASK_AI_MODEL: AskAIModelId = 'openai/gpt-5.4-mini'

export const ASK_AI_MODELS = [
  {
    brand: 'openai',
    context: '400K context window',
    description: '响应更快、成本更低，适合日常文档问答与操作指引。',
    id: 'openai/gpt-5.4-mini',
    name: 'GPT 5.4 Mini',
  },
  {
    brand: 'openai',
    context: '400K context window',
    description: '适合复杂推理、疑难排查和多轮文档追问。',
    id: 'openai/gpt-5.2',
    name: 'GPT 5.2',
  },
  {
    brand: 'qwen',
    context: '1M context window',
    description: '擅长中文、长上下文理解和工具调用。',
    id: 'alibaba/qwen3.5-plus',
    name: 'Qwen 3.5 Plus',
  },
] as const satisfies ReadonlyArray<{
  brand: 'openai' | 'qwen'
  context: string
  description: string
  id: AskAIModelId
  name: string
}>

export const ASK_AI_SKILL_IDS = ['deep-research', 'summarize', 'step-by-step', 'troubleshoot'] as const

export type AskAISkillId = (typeof ASK_AI_SKILL_IDS)[number]

export const MAX_ASK_AI_SKILLS = ASK_AI_SKILL_IDS.length

export const ASK_AI_SKILLS = [
  {
    description: '扩大文档检索范围，交叉核对并附上相关来源。',
    id: 'deep-research',
    name: 'Deep Research',
  },
  {
    description: '先给出结论和关键要点，再补充必要说明。',
    id: 'summarize',
    name: 'Summarize',
  },
  {
    description: '按前置条件、步骤和验证方式组织回答。',
    id: 'step-by-step',
    name: 'Step by Step',
  },
  {
    description: '按现象、原因、检查方法和修复建议排查问题。',
    id: 'troubleshoot',
    name: 'Troubleshoot',
  },
] as const satisfies ReadonlyArray<{
  description: string
  id: AskAISkillId
  name: string
}>
