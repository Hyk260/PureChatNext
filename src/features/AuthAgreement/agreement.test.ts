import { afterEach, describe, expect, it } from 'vitest'

import {
  AUTH_AGREEMENT_STORAGE_KEY,
  isAuthAgreementAccepted,
  setAuthAgreementAccepted,
  subscribeAuthAgreement,
} from './agreement'

afterEach(() => {
  setAuthAgreementAccepted(false)
  sessionStorage.clear()
})

describe('auth agreement storage', () => {
  it('persists accepted state for login/signup to share', () => {
    expect(isAuthAgreementAccepted()).toBe(false)

    setAuthAgreementAccepted(true)

    expect(isAuthAgreementAccepted()).toBe(true)
    expect(sessionStorage.getItem(AUTH_AGREEMENT_STORAGE_KEY)).toBe('1')
  })

  it('notifies subscribers when the checkbox state changes', () => {
    const seen: boolean[] = []
    const unsubscribe = subscribeAuthAgreement(() => {
      seen.push(isAuthAgreementAccepted())
    })

    setAuthAgreementAccepted(true)
    setAuthAgreementAccepted(false)
    unsubscribe()
    setAuthAgreementAccepted(true)

    expect(seen).toEqual([true, false])
  })
})
