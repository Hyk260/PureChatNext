import { APICallError } from 'ai'

export const PUREHUB_MODEL_UNAVAILABLE_MESSAGE = '该模型在 PureHub 免费套餐中暂不可用，请切换到其他模型。'

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

const getErrorDetails = (error: unknown) => {
  if (APICallError.isInstance(error)) {
    return {
      message: [error.name, error.message, error.responseBody, safeStringify(error.data)].filter(Boolean).join(' '),
      statusCode: error.statusCode,
    }
  }

  if (error instanceof Error) {
    const candidate = error as Error & {
      data?: unknown
      responseBody?: string
      statusCode?: number
    }
    return {
      message: [candidate.name, candidate.message, candidate.responseBody, safeStringify(candidate.data)]
        .filter(Boolean)
        .join(' '),
      statusCode: candidate.statusCode,
    }
  }

  return { message: safeStringify(error), statusCode: undefined }
}

export const isPureHubRestrictedModelError = (error: unknown) => {
  const { message, statusCode } = getErrorDetails(error)
  if (/RestrictedModelsError|Free tier users do not have access|free credits.*restricted/i.test(message)) {
    return true
  }

  return statusCode === 403 && /no_providers_available/i.test(message)
}

export const getPureHubStreamErrorMessage = (error: unknown) => {
  if (isPureHubRestrictedModelError(error)) return PUREHUB_MODEL_UNAVAILABLE_MESSAGE

  const { message, statusCode } = getErrorDetails(error)
  if (statusCode === 429 || /rate.?limit/i.test(message)) return '上游限流，请稍后重试。'
  if (statusCode === 401 || /unauthorized|invalid.*key/i.test(message)) {
    return '模型服务暂不可用，请稍后重试。'
  }

  return '模型生成失败，请稍后重试。'
}
