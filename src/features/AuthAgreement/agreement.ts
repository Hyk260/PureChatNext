import { sessionStg } from '@pure/utils/storage'

export const AUTH_AGREEMENT_STORAGE_KEY = 'purechat:auth:agreement'

const listeners = new Set<() => void>()

export const isAuthAgreementAccepted = () => sessionStg.getString(AUTH_AGREEMENT_STORAGE_KEY) === '1'

export const setAuthAgreementAccepted = (accepted: boolean) => {
  if (accepted) sessionStg.setString(AUTH_AGREEMENT_STORAGE_KEY, '1')
  else sessionStg.remove(AUTH_AGREEMENT_STORAGE_KEY)

  for (const listener of listeners) listener()
}

export const subscribeAuthAgreement = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
