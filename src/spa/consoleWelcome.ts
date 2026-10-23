import { SITE_DESCRIPTION, SITE_NAME, SITE_REPOSITORY_URL } from '@/const/site'

type ConsoleWelcomeLocale = 'zh-CN' | 'en-US'

interface ConsoleWelcomeMessages {
  stack: string
  introduction: string
  description: string
  repository: string
  email: string
  community: string
}

const MESSAGES: Record<ConsoleWelcomeLocale, ConsoleWelcomeMessages> = {
  'zh-CN': {
    stack: '基于 React 19 · Vite · Next.js · Vercel AI SDK 构建',
    introduction:
      'Hi！我是 PureChat 的作者 Hyk260，很高兴在控制台与你相遇。\n欢迎分享使用体验、反馈问题，或一起探索 AI 助手的更多可能。',
    description: SITE_DESCRIPTION,
    repository: '查看源码 / 参与贡献',
    email: '邮件交流',
    community: '加入 PureChat 交流群',
  },
  'en-US': {
    stack: 'Built with React 19 · Vite · Next.js · Vercel AI SDK',
    introduction:
      "Hi! I'm Hyk260, the creator of PureChat. Nice to meet you in the console.\nShare your experience, report an issue, or help explore what AI assistants can do.",
    description:
      'An open-source, self-hosted AI workspace for individuals and small teams, with WeChat and QQ integration, multiple models, web search, and file processing.',
    repository: 'Source code / Contribute',
    email: 'Get in touch by email',
    community: 'Join the PureChat QQ community',
  },
}

const CONTACT_EMAIL = '2607881950@qq.com'
const COMMUNITY_URL = 'https://qm.qq.com/q/kNp1soa8W4'
const BRAND_STYLE = 'color: #fadfa3; background: #030307; padding: 6px 10px; font-weight: bold;'
const STACK_STYLE = 'color: #030307; background: #fadfa3; padding: 6px 10px;'
const TEXT_STYLE = 'line-height: 1.8;'
const LINK_STYLE = 'line-height: 1.8; color: #d97706;'

/** 启动入口调用一次；默认中文，后续可传入应用语言设置。 */
export function printConsoleWelcome(locale: ConsoleWelcomeLocale = 'zh-CN'): void {
  const messages = MESSAGES[locale]

  console.info(`%c${SITE_NAME}%c${messages.stack}`, BRAND_STYLE, STACK_STYLE)
  console.info(`%c${messages.description}\n\n${messages.introduction}`, TEXT_STYLE)
  console.info(`%c${messages.repository}: %c${SITE_REPOSITORY_URL}`, TEXT_STYLE, LINK_STYLE)
  console.info(`%c${messages.email}: %c${CONTACT_EMAIL}`, TEXT_STYLE, LINK_STYLE)
  console.info(`%c${messages.community}: %c${COMMUNITY_URL}`, TEXT_STYLE, LINK_STYLE)
}
