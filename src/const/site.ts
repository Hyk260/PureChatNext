export const SITE_NAME = 'PureChat'

export const SITE_TITLE = 'PureChat — 把你的 AI 助手接入微信和 QQ'

export const SITE_DESCRIPTION =
  '面向中文用户和小团队的开源自托管 AI 工作台，支持微信与 QQ、多模型、联网搜索、文件处理和私有部署。'

export const SITE_DEFAULT_URL = 'https://next.purechat.cn'

export const SITE_REPOSITORY_URL = 'https://github.com/Hyk260/PureChatNext'

export const SITE_DISCUSSIONS_URL = `${SITE_REPOSITORY_URL}/discussions`

export const SITE_ISSUES_URL = `${SITE_REPOSITORY_URL}/issues`

export const SITE_KEYWORDS = [
  'AI 助手',
  'AI 聊天',
  '微信机器人',
  'QQ 机器人',
  '自托管',
  '多模型',
  '联网搜索',
  '文件处理',
  'Vercel AI SDK',
  'Next.js',
  'React',
]

export const PUBLIC_SPA_PATHS = ['/', '/community', '/help', '/privacy', '/terms'] as const

export const isPublicSpaPath = (pathname: string) =>
  PUBLIC_SPA_PATHS.some((publicPath) =>
    publicPath === '/' ? pathname === '/' : pathname === publicPath || pathname.startsWith(`${publicPath}/`)
  )
