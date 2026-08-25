import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import { ExternalLink } from 'lucide-react'
import { Brand } from '@/components/brand'
import { PRODUCT_URL, QUICK_START_URL, REPOSITORY_URL } from '@/lib/site'

export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: REPOSITORY_URL,
    links: [
      {
        external: true,
        on: 'menu',
        text: '产品首页',
        type: 'main',
        url: PRODUCT_URL,
      },
      {
        external: true,
        on: 'menu',
        text: 'GitHub',
        type: 'main',
        url: REPOSITORY_URL,
      },
      {
        icon: <ExternalLink aria-hidden className='size-4' />,
        on: 'menu',
        text: '开始使用',
        type: 'button',
        url: QUICK_START_URL,
      },
    ],
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
      mode: 'light-dark-system',
    },
  }
}
