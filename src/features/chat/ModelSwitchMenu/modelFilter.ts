import type { ModelAbilities } from '@pure/model-bank'
import { OPENAI_SPEECH_MODELS, QWEN_SPEECH_MODELS } from '@pure/const'

import type { HomeModelItem } from '@/const/home/models'

const NATIVE_TTS_MODELS = new Set([
  ...QWEN_SPEECH_MODELS.map((model) => `bailian:${model}`),
  ...OPENAI_SPEECH_MODELS.map((model) => `openai:${model}`),
])

export const hasRequiredModelAbility = (model: HomeModelItem, ability?: keyof ModelAbilities) =>
  ability === undefined || model.abilities?.[ability] === true

export const hasExcludedModelAbilities = (model: HomeModelItem, excludedAbilities: Array<keyof ModelAbilities> = []) =>
  excludedAbilities.every((ability) => model.abilities?.[ability] !== true)

export const withNativeTTSAbility = (provider: string, model: string, abilities?: ModelAbilities) =>
  NATIVE_TTS_MODELS.has(`${provider}:${model}`) ? { ...abilities, textToSpeech: true } : abilities
