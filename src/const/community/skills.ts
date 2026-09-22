import { SkillCategory } from '@/features/community/types'
import type { DiscoverSkillItem, SkillMarketCategory } from '@/features/community/types'

import { COMMUNITY_SKILLS_DATA } from './skills.data'

/** Business categories (excludes `all`), ordered by marketplace volume. */
export const SKILL_BUSINESS_CATEGORIES = [
  SkillCategory.CodingAgentsIDEs,
  SkillCategory.WebFrontendDevelopment,
  SkillCategory.DevOpsCloud,
  SkillCategory.SearchResearch,
  SkillCategory.BrowserAutomation,
  SkillCategory.ProductivityTasks,
  SkillCategory.AILLMs,
  SkillCategory.CLIUtilities,
  SkillCategory.GitGitHub,
  SkillCategory.ImageVideoGeneration,
  SkillCategory.Communication,
  SkillCategory.Transportation,
  SkillCategory.PDFDocuments,
  SkillCategory.MarketingSales,
  SkillCategory.HealthFitness,
  SkillCategory.MediaStreaming,
  SkillCategory.NotesPKM,
  SkillCategory.CalendarScheduling,
  SkillCategory.ShoppingEcommerce,
  SkillCategory.SecurityPasswords,
  SkillCategory.PersonalDevelopment,
  SkillCategory.SpeechTranscription,
  SkillCategory.AppleAppsServices,
  SkillCategory.SmartHomeIoT,
  SkillCategory.Gaming,
  SkillCategory.ClawdbotTools,
  SkillCategory.SelfHostedAutomation,
  SkillCategory.IOSMacOSDevelopment,
  SkillCategory.Moltbook,
  SkillCategory.DataAnalytics,
  SkillCategory.Finance,
  SkillCategory.AgentToAgentProtocols,
] as const satisfies readonly SkillMarketCategory[]

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  [SkillCategory.All]: '全部',
  [SkillCategory.AgentToAgentProtocols]: '代理间协议',
  [SkillCategory.AILLMs]: 'AI 与大模型',
  [SkillCategory.AppleAppsServices]: '苹果应用与服务',
  [SkillCategory.BrowserAutomation]: '浏览器自动化',
  [SkillCategory.CalendarScheduling]: '日历与日程',
  [SkillCategory.ClawdbotTools]: 'Clawdbot 工具',
  [SkillCategory.CLIUtilities]: 'CLI 工具',
  [SkillCategory.CodingAgentsIDEs]: '编程代理与 IDE',
  [SkillCategory.Communication]: '沟通与协作',
  [SkillCategory.DataAnalytics]: '数据分析',
  [SkillCategory.DevOpsCloud]: 'DevOps 与云',
  [SkillCategory.Finance]: '金融',
  [SkillCategory.Gaming]: '游戏',
  [SkillCategory.GitGitHub]: 'Git 与 GitHub',
  [SkillCategory.HealthFitness]: '健康健身',
  [SkillCategory.ImageVideoGeneration]: '图像与视频生成',
  [SkillCategory.IOSMacOSDevelopment]: 'iOS 与 macOS 开发',
  [SkillCategory.MarketingSales]: '营销与销售',
  [SkillCategory.MediaStreaming]: '媒体与流媒体',
  [SkillCategory.Moltbook]: 'Moltbook',
  [SkillCategory.NotesPKM]: '笔记与知识管理',
  [SkillCategory.PDFDocuments]: 'PDF 与文档',
  [SkillCategory.PersonalDevelopment]: '个人发展',
  [SkillCategory.ProductivityTasks]: '生产力与任务',
  [SkillCategory.SearchResearch]: '搜索与研究',
  [SkillCategory.SecurityPasswords]: '安全与密码',
  [SkillCategory.SelfHostedAutomation]: '自托管与自动化',
  [SkillCategory.ShoppingEcommerce]: '购物与电商',
  [SkillCategory.SmartHomeIoT]: '智能家居与物联网',
  [SkillCategory.SpeechTranscription]: '语音与转录',
  [SkillCategory.Transportation]: '交通运输',
  [SkillCategory.WebFrontendDevelopment]: 'Web 与前端开发',
}

/** 手选的社区技能目录。草稿来自 `pnpm skills:sync`，脚本不会覆盖。 */
export const COMMUNITY_SKILLS: DiscoverSkillItem[] = COMMUNITY_SKILLS_DATA

export const findCommunitySkill = (identifier: string) =>
  COMMUNITY_SKILLS.find((skill) => skill.identifier === identifier) ?? null

export const getCommunitySkillSourceUrl = (skill: DiscoverSkillItem) => {
  const homepage = skill.homepage?.trim()
  if (homepage) return homepage
  const githubUrl = skill.github?.url?.trim()
  return githubUrl || null
}

export const getSkillCategoryCounts = (
  skills: DiscoverSkillItem[] = COMMUNITY_SKILLS
): Record<SkillCategory, number> => {
  const counts = Object.fromEntries(Object.values(SkillCategory).map((key) => [key, 0])) as Record<
    SkillCategory,
    number
  >

  for (const skill of skills) {
    counts[skill.category] += 1
  }

  counts[SkillCategory.All] = skills.length
  return counts
}

export const filterCommunitySkills = (
  skills: DiscoverSkillItem[],
  options: { category?: string | null; q?: string | null }
): DiscoverSkillItem[] => {
  const category = options.category ?? SkillCategory.All
  const query = options.q?.trim().toLowerCase() ?? ''

  return skills.filter((skill) => {
    const matchCategory = category === SkillCategory.All || skill.category === category
    if (!matchCategory) return false

    if (!query) return true

    const haystack = [skill.name, skill.description, skill.author, skill.identifier].join(' ').toLowerCase()
    return haystack.includes(query)
  })
}
