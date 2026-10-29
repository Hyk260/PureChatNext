export class TaskServiceError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message)
    this.name = 'TaskServiceError'
  }
}

export function taskErrorSummary(error: unknown): { message: string; retryable: boolean; code: string } {
  if (error instanceof TaskServiceError) return { code: 'CONFIGURATION', message: error.message, retryable: false }
  const details = error as { code?: unknown; isRetryable?: boolean; name?: string; statusCode?: number }
  const status = details?.statusCode
  if (status === 401 || status === 403)
    return { code: 'MODEL_AUTH', message: '模型授权失败，请检查服务商 API Key 和模型权限', retryable: false }
  if (status === 429) return { code: 'RATE_LIMIT', message: '模型服务暂时限流，请稍后重试', retryable: true }
  if (details?.name === 'TimeoutError')
    return { code: 'TIMEOUT', message: '任务执行超过 5 分钟，已停止', retryable: true }
  const retryable = details?.isRetryable === true || (typeof status === 'number' && status >= 500)
  return {
    code: retryable ? 'TEMPORARY_SERVICE_ERROR' : 'EXECUTION_ERROR',
    message: retryable ? '执行服务暂时不可用，请稍后重试' : '执行失败，请检查模型、搜索服务和任务配置',
    retryable,
  }
}
