import { SITE_DESCRIPTION, SITE_TITLE } from './site'

export type PublicSpaRouteMetadata = {
  canonicalPath: string
  description: string
  indexable: boolean
  /** 百度等搜索引擎仍会参考 keywords，按页面主题补充。 */
  keywords?: string[]
  openGraphType: 'website'
  structuredData?: 'software-application'
  title: string
}

export const PUBLIC_SPA_ROUTE_METADATA: Record<string, PublicSpaRouteMetadata> = {
  '/': {
    canonicalPath: '/',
    description: SITE_DESCRIPTION,
    indexable: false,
    openGraphType: 'website',
    structuredData: 'software-application',
    title: SITE_TITLE,
  },
  '/community': {
    canonicalPath: '/community/provider',
    description: '浏览 PureChat 社区的模型服务商目录。',
    indexable: false,
    openGraphType: 'website',
    title: 'PureChat 社区',
  },
  '/community/agent': {
    canonicalPath: '/community/agent',
    description: '浏览和使用 PureChat 社区中的 AI 助手与 Agent 模板。',
    indexable: true,
    keywords: ['AI 助手模板', 'Agent 模板', 'AI 智能体', 'PureChat 社区'],
    openGraphType: 'website',
    title: 'AI 助手与 Agent 模板 | PureChat',
  },
  '/community/model': {
    canonicalPath: '/community/model',
    description: 'PureChat 社区模型目录暂未开放。',
    indexable: false,
    openGraphType: 'website',
    title: '模型目录 | PureChat',
  },
  '/community/provider': {
    canonicalPath: '/community/provider',
    description: '查看 PureChat 支持的 AI 服务商，了解多模型接入入口。',
    indexable: true,
    keywords: ['AI 服务商', '大模型接入', '多模型', 'API Key 配置'],
    openGraphType: 'website',
    title: 'AI 服务商目录 | PureChat',
  },
  '/community/skill': {
    canonicalPath: '/community/skill',
    description: '浏览 PureChat 社区技能，了解可添加到 AI 助手的实用能力。',
    indexable: true,
    keywords: ['AI 技能', 'Skill', 'Agent 能力扩展', 'PureChat 社区'],
    openGraphType: 'website',
    title: 'AI 技能目录 | PureChat',
  },
  '/help': {
    canonicalPath: '/help',
    description: 'PureChat 使用帮助：快速开始、自托管部署、微信与 QQ 接入及问题反馈。',
    indexable: true,
    keywords: ['PureChat 帮助', '使用教程', '自托管部署', '微信接入', 'QQ 接入'],
    openGraphType: 'website',
    title: '帮助与支持 | PureChat',
  },
  '/privacy': {
    canonicalPath: '/privacy',
    description: '了解 PureChat 如何处理服务运行所需的数据与隐私信息。',
    indexable: true,
    keywords: ['隐私政策', '数据处理', '自托管安全'],
    openGraphType: 'website',
    title: '隐私政策 | PureChat',
  },
  '/terms': {
    canonicalPath: '/terms',
    description: '查看 PureChat 服务使用条款与用户责任说明。',
    indexable: true,
    keywords: ['服务条款', '使用协议', '用户责任'],
    openGraphType: 'website',
    title: '服务条款 | PureChat',
  },
}

export const PUBLIC_SPA_PATHS = Object.entries(PUBLIC_SPA_ROUTE_METADATA)
  .filter(([, metadata]) => metadata.indexable)
  .map(([pathname]) => pathname)

export const PUBLIC_SPA_FILTER_PARAMS = ['category', 'page', 'q'] as const

export const getPublicSpaRouteMetadata = (pathname: string, hasFilters = false): PublicSpaRouteMetadata => {
  const metadata = PUBLIC_SPA_ROUTE_METADATA[pathname]

  if (!metadata) {
    return {
      canonicalPath: pathname,
      description: SITE_DESCRIPTION,
      indexable: false,
      openGraphType: 'website',
      title: SITE_TITLE,
    }
  }

  if (hasFilters && pathname.startsWith('/community/')) {
    return { ...metadata, indexable: false }
  }

  return metadata
}
