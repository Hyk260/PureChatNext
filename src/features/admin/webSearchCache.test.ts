import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  clearWebSearchCache,
  readWebSearchCache,
  WEB_SEARCH_CACHE_KEY,
  writeWebSearchCacheSlot,
} from './webSearchCache'

describe('webSearchCache', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    clearWebSearchCache()
  })

  it('writes and reads validated action slots', () => {
    const slot = { form: { query: 'hello' }, payload: { results: [] }, runState: { status: 200 } }

    writeWebSearchCacheSlot('query', slot)

    expect(readWebSearchCache()).toEqual({ query: slot })
  })

  it('keeps the runtime slot validation when reading unknown JSON', () => {
    localStorage.setItem(
      WEB_SEARCH_CACHE_KEY,
      JSON.stringify({
        query: { form: { query: 'valid' }, payload: false, runState: 0 },
        webSearch: { payload: 'missing run state' },
        unknown: { form: {}, payload: true, runState: true },
      })
    )

    expect(readWebSearchCache()).toEqual({
      query: { form: { query: 'valid' }, payload: false, runState: 0 },
    })
  })
})
