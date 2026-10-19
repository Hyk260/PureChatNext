import UAParser from 'ua-parser-js'

import type { UserDeviceInfo } from '@pure/database/schemas'

const ELECTRON_OS_NAMES: Record<string, string> = {
  darwin: 'macOS',
  linux: 'Linux',
  win32: 'Windows',
}

const readHeaderValue = (headers: Headers, name: string, maxLength = 100) => {
  const value = headers.get(name)?.trim().slice(0, maxLength)
  return value || null
}

const getElectronDeviceInfo = (headers: Headers): UserDeviceInfo => {
  const platform = readHeaderValue(headers, 'x-purechat-platform', 32)

  return {
    appVersion: readHeaderValue(headers, 'x-purechat-app-version', 64),
    architecture: readHeaderValue(headers, 'x-purechat-architecture', 32),
    browser: null,
    browserVersion: null,
    clientType: 'electron',
    deviceType: 'desktop',
    os: platform ? ELECTRON_OS_NAMES[platform] ?? platform : null,
    osVersion: readHeaderValue(headers, 'x-purechat-os-version', 80),
  }
}

export function getUserDeviceInfo(headers: Headers): UserDeviceInfo | null {
  if (headers.get('x-purechat-client') === 'electron') return getElectronDeviceInfo(headers)

  const userAgent = headers.get('user-agent')?.trim()
  if (!userAgent) return null

  const { browser, device, os } = new UAParser(userAgent).getResult()
  const parsedDeviceType = device.type
  let deviceType: UserDeviceInfo['deviceType'] = 'unknown'
  if (parsedDeviceType === 'mobile' || parsedDeviceType === 'tablet') deviceType = parsedDeviceType
  else if (!parsedDeviceType && os.name) deviceType = 'desktop'

  return {
    appVersion: null,
    architecture: null,
    browser: browser.name?.slice(0, 100) ?? null,
    browserVersion: browser.version?.slice(0, 100) ?? null,
    clientType: 'web',
    deviceType,
    os: os.name?.slice(0, 100) ?? null,
    osVersion: os.version?.slice(0, 100) ?? null,
  }
}
