import { ApiKeyManager } from '../apiKeyManager'

/** @deprecated Prefer `ApiKeyManager` from `@pure/utils` */
export class ClientApiKeyManager extends ApiKeyManager {
  constructor() {
    super('random')
  }
}

export const clientApiKeyManager = new ClientApiKeyManager()
