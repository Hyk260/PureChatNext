'use client'

import { Code2, ExternalLink, Rocket } from 'lucide-react'
import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch'
import { PRODUCT_URL, QUICK_START_URL, REPOSITORY_URL } from '@/lib/site'

export function SidebarFooter() {
  return (
    <div className='grid gap-2 border-t border-fd-border pt-3'>
      <div className='flex items-center gap-1'>
        <a className='docs-sidebar-action' href={PRODUCT_URL} rel='noreferrer' target='_blank'>
          <ExternalLink aria-hidden className='size-4' />
          产品首页
        </a>
        <a aria-label='GitHub' className='docs-sidebar-icon' href={REPOSITORY_URL} rel='noreferrer' target='_blank'>
          <Code2 aria-hidden className='size-4' />
        </a>
        <ThemeSwitch className='docs-sidebar-theme' mode='light-dark-system' />
      </div>
      <a className='docs-sidebar-primary' href={QUICK_START_URL}>
        <Rocket aria-hidden className='size-4' />
        开始使用
      </a>
    </div>
  )
}
