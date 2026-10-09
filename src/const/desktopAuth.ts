export const DESKTOP_AUTH_CLIENT_ID = 'purechat-desktop'
export const DESKTOP_AUTH_REDIRECT_URI = 'purechat://auth/callback'

export const isDesktopAuthRedirectUri = (value: string) => value === DESKTOP_AUTH_REDIRECT_URI
