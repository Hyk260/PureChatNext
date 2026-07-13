import type { HomeModelItem } from '@/const/home/models'

export interface StarterModelItem extends HomeModelItem {
  label: string
}

export const STARTER_MODELS: StarterModelItem[] = [
  {
    displayName: 'Claude Fable 5',
    label: 'Claude Fable 5',
    model: 'gpt-4o',
    provider: 'openai',
  },
  {
    displayName: 'Claude Sonnet 5',
    label: 'Claude Sonnet 5',
    model: 'gpt-4o-mini',
    provider: 'openai',
  },
  {
    displayName: 'Nano Banana 2 Lite',
    label: 'Nano Banana 2 Lite',
    model: 'deepseek-v4-flash',
    provider: 'deepseek',
  },
  {
    displayName: 'Seedance 2.0',
    label: 'Seedance 2.0',
    model: 'deepseek-v4-pro',
    provider: 'deepseek',
  },
]
