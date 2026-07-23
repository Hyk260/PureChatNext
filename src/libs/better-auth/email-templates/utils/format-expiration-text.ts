export function formatExpirationText(expiresInSeconds: number): string {
  const expiresInHours = expiresInSeconds / 3600

  if (expiresInHours >= 1) {
    return `${Math.round(expiresInHours)} 小时`
  }

  const expiresInMinutes = expiresInSeconds / 60

  if (expiresInMinutes >= 1) {
    return `${Math.round(expiresInMinutes)} 分钟`
  }

  return `${expiresInSeconds} 秒`
}
