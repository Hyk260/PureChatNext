import {
  AI_MODELS_BY_PROVIDER,
  ModelProvider,
  PUREHUB_DEFAULT_MODEL,
  getAiModel,
} from '@pure/model-bank'

export interface HomeModelItem {
  displayName: string
  model: string
  provider: string
}

export const HOME_MODELS: HomeModelItem[] = (
  Object.entries(AI_MODELS_BY_PROVIDER) as Array<
    [keyof typeof AI_MODELS_BY_PROVIDER, (typeof AI_MODELS_BY_PROVIDER)[keyof typeof AI_MODELS_BY_PROVIDER]]
  >
).flatMap(([provider, models]) =>
  models
    .filter((model) => model.enabled !== false)
    .map((model) => ({
      displayName: model.displayName,
      model: model.id,
      provider,
    }))
)

export const DEFAULT_HOME_MODEL: HomeModelItem = {
  displayName: getAiModel(ModelProvider.PureHub, PUREHUB_DEFAULT_MODEL)?.displayName ?? 'GPT-5.4 Mini',
  model: PUREHUB_DEFAULT_MODEL,
  provider: ModelProvider.PureHub,
}

export const findHomeModel = (provider: string, model: string) =>
  HOME_MODELS.find((item) => item.provider === provider && item.model === model) ?? DEFAULT_HOME_MODEL

export const groupHomeModelsByProvider = () => {
  const groups = new Map<string, HomeModelItem[]>()

  for (const item of HOME_MODELS) {
    const list = groups.get(item.provider) ?? []
    list.push(item)
    groups.set(item.provider, list)
  }

  return groups
}
