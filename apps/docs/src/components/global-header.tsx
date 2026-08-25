'use client'

import { ExternalLink, Menu, Rocket } from 'lucide-react'
import Link from 'next/link'
import type { ComponentProps } from 'react'
import { useDocsLayout } from 'fumadocs-ui/layouts/docs'
import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch'
import { Brand } from '@/components/brand'
import { PRODUCT_URL, QUICK_START_URL, REPOSITORY_URL } from '@/lib/site'

export function GlobalHeader(props: ComponentProps<'header'>) {
  const { slots } = useDocsLayout()

  return (
    <header {...props} className='docs-global-header'>
      <div className='docs-mobile-header'>
        <Link aria-label='PureChat Docs 首页' className='inline-flex items-center' href='/'>
          <Brand />
        </Link>
        <div className='ml-auto flex items-center gap-1'>
          {slots.searchTrigger ? <slots.searchTrigger.sm className='p-2' hideIfDisabled /> : null}
          {slots.sidebar ? (
            <slots.sidebar.trigger aria-label='打开文档导航' className='rounded-lg p-2 hover:bg-fd-accent'>
              <Menu aria-hidden className='size-5' />
            </slots.sidebar.trigger>
          ) : null}
        </div>
      </div>

      <div className='docs-desktop-header'>
        <Link aria-label='PureChat Docs 首页' className='shrink-0' href='/'>
          <Brand />
        </Link>
        <nav aria-label='全局导航' className='ml-auto flex items-center gap-1'>
          <a className='docs-header-link' href={PRODUCT_URL} rel='noreferrer' target='_blank'>
            产品首页
          </a>
          <a className='docs-header-link' href={REPOSITORY_URL} rel='noreferrer' target='_blank'>
            <ExternalLink aria-hidden className='size-4' />
            GitHub
          </a>
          <ThemeSwitch className='mx-1' mode='light-dark-system' />
          <a className='docs-header-primary' href={QUICK_START_URL}>
            <Rocket aria-hidden className='size-4' />
            开始使用
          </a>
        </nav>
      </div>
    </header>
  )
}
