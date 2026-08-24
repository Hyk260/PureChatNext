export type StorageType = 'local' | 'session'

type SafeStorage = {
  getJson: (key: string) => unknown | null
  getString: (key: string) => string | null
  remove: (key: string) => boolean
  setJson: (key: string, value: unknown) => boolean
  setString: (key: string, value: string) => boolean
}

const resolveStorage = (type: StorageType): Storage | null => {
  try {
    if (typeof window === 'undefined') return null
    return type === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export const createStorage = (type: StorageType, prefix = ''): SafeStorage => {
  const prefixedKey = (key: string) => `${prefix}${key}`
  const getString = (key: string) => {
    try {
      return resolveStorage(type)?.getItem(prefixedKey(key)) ?? null
    } catch {
      return null
    }
  }

  return {
    getJson: (key) => {
      const raw = getString(key)
      if (raw === null) return null

      try {
        return JSON.parse(raw) as unknown
      } catch {
        return null
      }
    },
    getString,
    remove: (key) => {
      try {
        const storage = resolveStorage(type)
        if (!storage) return false

        storage.removeItem(prefixedKey(key))
        return true
      } catch {
        return false
      }
    },
    setJson: (key, value) => {
      try {
        const serialized = JSON.stringify(value)
        if (serialized === undefined) return false

        const storage = resolveStorage(type)
        if (!storage) return false

        storage.setItem(prefixedKey(key), serialized)
        return true
      } catch {
        return false
      }
    },
    setString: (key, value) => {
      try {
        const storage = resolveStorage(type)
        if (!storage) return false

        storage.setItem(prefixedKey(key), value)
        return true
      } catch {
        return false
      }
    },
  }
}

export const localStg = createStorage('local')
export const sessionStg = createStorage('session')
