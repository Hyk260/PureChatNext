export const EMAIL_PROVIDER_FILTERS = {
  qq: { domains: ['qq.com'], label: 'QQ 邮箱' },
  '163': { domains: ['163.com'], label: '163 邮箱' },
  gmail: { domains: ['gmail.com', 'googlemail.com'], label: 'Google 邮箱' },
  '126': { domains: ['126.com'], label: '126 邮箱' },
  outlook: { domains: ['outlook.com', 'hotmail.com', 'live.com'], label: 'Outlook 邮箱' },
} as const

export type EmailProviderFilter = keyof typeof EMAIL_PROVIDER_FILTERS

export const isEmailProviderFilter = (value: unknown): value is EmailProviderFilter =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(EMAIL_PROVIDER_FILTERS, value)
