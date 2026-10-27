import type { ModelProviderId } from '@pure/const'

import { PURECHAT_DEFAULT_MODEL } from './aiModels/purechat'

export const PROVIDER_DEFAULT_MODELS: Readonly<Record<ModelProviderId, string>> = {
  deepseek: 'deepseek-v4-flash',
  openai: 'gpt-5.4-nano',
  purechat: PURECHAT_DEFAULT_MODEL,
}
