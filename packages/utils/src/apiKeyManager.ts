interface KeyStore {
  index: number
  keyLen: number
  keys: string[]
}

export type ApiKeySelectMode = 'random' | 'turn'

/**
 * Pick one key from a comma-separated API key list (random or round-robin).
 */
export class ApiKeyManager {
  private _cache = new Map<string, KeyStore>()

  private _mode: ApiKeySelectMode

  constructor(mode: ApiKeySelectMode = 'random') {
    this._mode = mode
  }

  private getKeyStore(apiKeys: string) {
    let store = this._cache.get(apiKeys)

    if (!store) {
      const keys = apiKeys
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean)

      store = { index: 0, keyLen: keys.length, keys }
      this._cache.set(apiKeys, store)
    }

    return store
  }

  pick(apiKeys = ''): string | undefined {
    if (!apiKeys) return undefined

    const store = this.getKeyStore(apiKeys)
    if (store.keyLen === 0) return undefined

    let index = 0

    if (this._mode === 'turn') index = store.index++ % store.keyLen
    if (this._mode === 'random') index = Math.floor(Math.random() * store.keyLen)

    return store.keys[index]
  }
}
