import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import { Brand } from '@/components/brand'

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Brand />,
      transparentMode: 'none',
      url: '/',
    },
    searchToggle: {
      full: {
        className: 'rounded-xl',
      },
    },
    themeSwitch: {
      enabled: false,
      mode: 'light-dark-system',
    },
  }
}
