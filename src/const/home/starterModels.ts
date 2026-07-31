import type { HomeModelItem } from '@/const/home/models'

export interface StarterModelItem extends HomeModelItem {
  label: string
}

export const STARTER_MODELS: StarterModelItem[] = [
  {
    displayName: 'GPT-5.6 Sol',
    label: 'GPT-5.6 Sol',
    model: 'gpt-5.6-sol',
    provider: 'openai',
  },
  {
    displayName: 'GPT-5.4 mini',
    label: 'GPT-5.4 mini',
    model: 'gpt-5.4-mini',
    provider: 'openai',
  },
  {
    displayName: 'DeepSeek V4 Flash',
    label: 'DeepSeek V4 Flash',
    model: 'deepseek-v4-flash',
    provider: 'deepseek',
  },
  {
    displayName: 'DeepSeek V4 Pro',
    label: 'DeepSeek V4 Pro',
    model: 'deepseek-v4-pro',
    provider: 'deepseek',
  },
]
