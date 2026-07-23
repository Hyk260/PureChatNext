export const ChatErrorType = {
  InvalidAccessCode: "InvalidAccessCode",
  FreePlanLimit: "FreePlanLimit",
  SubscriptionPlanLimit: "SubscriptionPlanLimit",
  InsufficientBudgetForModel: "InsufficientBudgetForModel",
  SubscriptionKeyMismatch: "SubscriptionKeyMismatch",
  SupervisorDecisionFailed: "SupervisorDecisionFailed",
  InvalidUserKey: "InvalidUserKey",
  CreateMessageError: "CreateMessageError",
  ModelDeprecated: "ModelDeprecated",
  NoOpenAIAPIKey: "NoOpenAIAPIKey",
  OllamaServiceUnavailable: "OllamaServiceUnavailable",
  PluginFailToTransformArguments: "PluginFailToTransformArguments",
  UnknownChatFetchError: "UnknownChatFetchError",
  SystemTimeNotMatchError: "SystemTimeNotMatchError",
  ServerAgentRuntimeError: "ServerAgentRuntimeError",
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  ContentNotFound: 404,
  MethodNotAllowed: 405,
  TooManyRequests: 429,
  InternalServerError: 500,
  BadGateway: 502,
  ServiceUnavailable: 503,
  GatewayTimeout: 504,
} as const

export type ErrorType = (typeof ChatErrorType)[keyof typeof ChatErrorType]

export interface ErrorResponse {
  body: unknown
  errorType: ErrorType
}
