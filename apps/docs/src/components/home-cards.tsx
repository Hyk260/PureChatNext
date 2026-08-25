import { ArrowRight, Code2, Rocket, ServerCog } from 'lucide-react'
import Link from 'next/link'

const cards = [
  {
    description: '从安装依赖、配置环境到启动开发服务，完成第一次本地运行。',
    href: '/getting-started/quick-start',
    icon: Rocket,
    title: '快速开始',
  },
  {
    description: '配置生产环境、Docker、数据库、搜索、邮件与消息渠道。',
    href: '/self-hosting',
    icon: ServerCog,
    title: '自托管',
  },
  {
    description: '了解数据库迁移、质量检查和 PureChatNext 前端样式约定。',
    href: '/development',
    icon: Code2,
    title: '开发指南',
  },
]

export function HomeCards() {
  return (
    <section aria-label='文档分类' className='not-prose my-8 grid gap-4 md:grid-cols-3'>
      {cards.map(({ description, href, icon: Icon, title }) => (
        <Link className='docs-home-card group' href={href} key={href}>
          <span className='flex size-10 items-center justify-center rounded-xl bg-fd-primary/10 text-fd-primary'>
            <Icon aria-hidden className='size-5' />
          </span>
          <span className='mt-5 flex items-center justify-between gap-3 font-semibold'>
            {title}
            <ArrowRight aria-hidden className='size-4 transition-transform group-hover:translate-x-1' />
          </span>
          <span className='mt-2 text-sm leading-6 text-fd-muted-foreground'>{description}</span>
        </Link>
      ))}
    </section>
  )
}
