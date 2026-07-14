import {
  AssistantCategory,
  type DiscoverAgentItem,
} from '@/features/community/types'

/** Business categories (excludes `all`). */
export const ASSISTANT_BUSINESS_CATEGORIES = [
  AssistantCategory.Academic,
  AssistantCategory.Career,
  AssistantCategory.CopyWriting,
  AssistantCategory.Design,
  AssistantCategory.Education,
  AssistantCategory.Emotions,
  AssistantCategory.Entertainment,
  AssistantCategory.Games,
  AssistantCategory.General,
  AssistantCategory.Life,
  AssistantCategory.Marketing,
  AssistantCategory.Office,
  AssistantCategory.Programming,
  AssistantCategory.Translation,
] as const

export type AssistantBusinessCategory = (typeof ASSISTANT_BUSINESS_CATEGORIES)[number]

export const ASSISTANT_CATEGORY_LABELS: Record<AssistantCategory, string> = {
  [AssistantCategory.All]: '全部',
  [AssistantCategory.Academic]: '学术',
  [AssistantCategory.Career]: '职业',
  [AssistantCategory.CopyWriting]: '文案',
  [AssistantCategory.Design]: '设计',
  [AssistantCategory.Education]: '教育',
  [AssistantCategory.Emotions]: '情感',
  [AssistantCategory.Entertainment]: '娱乐',
  [AssistantCategory.Games]: '游戏',
  [AssistantCategory.General]: '通用',
  [AssistantCategory.Life]: '生活',
  [AssistantCategory.Marketing]: '创业',
  [AssistantCategory.Office]: '办公',
  [AssistantCategory.Programming]: '编程',
  [AssistantCategory.Translation]: '翻译',
}

const CATEGORY_META: Record<
  AssistantBusinessCategory,
  { avatars: string[]; author: string; titles: string[]; topics: string[] }
> = {
  [AssistantCategory.Academic]: {
    author: 'PureChat',
    avatars: ['🔬', '📚', '🧪', '📖', '🧾'],
    titles: ['研究助理', '文献综述', '论文润色', '开题顾问', '数据分析'],
    topics: ['学术写作', '文献检索', '方法论', '同行评审', '假设检验'],
  },
  [AssistantCategory.Career]: {
    author: 'CareerLab',
    avatars: ['💼', '🧭', '📈', '🤝', '🗂️'],
    titles: ['简历教练', '面试陪练', '职业规划', '晋升顾问', '跳槽参谋'],
    topics: ['简历优化', '行为面试', '职场沟通', '薪资谈判', '能力盘点'],
  },
  [AssistantCategory.CopyWriting]: {
    author: 'CopyDesk',
    avatars: ['✍️', '📰', '🪧', '🎙️', '📝'],
    titles: ['文案创作者', '标题生成器', '品牌语调', '转化文案', '短视频脚本'],
    topics: ['种草文案', '产品卖点', '活动宣传', '社媒短句', '广告语'],
  },
  [AssistantCategory.Design]: {
    author: 'DesignLab',
    avatars: ['🎨', '🖼️', '✏️', '🖌️', '📐'],
    titles: ['设计参谋', '配色助手', 'UI 点评', '视觉提案', '版式顾问'],
    topics: ['界面层级', '配色方案', '组件规范', '插画风格', '设计评审'],
  },
  [AssistantCategory.Education]: {
    author: 'EduHub',
    avatars: ['🎓', '📘', '🧑‍🏫', '🧩', '✏️'],
    titles: ['学习教练', '课后辅导', '备课助手', '讲解老师', '测验出题'],
    topics: ['概念讲解', '习题拆解', '学习计划', '记忆方法', '课堂设计'],
  },
  [AssistantCategory.Emotions]: {
    author: 'MindCare',
    avatars: ['💬', '🫂', '🌱', '🕯️', '🤍'],
    titles: ['倾听伙伴', '情绪疏导', '自我觉察', '冲突调解', '正念陪练'],
    topics: ['压力释放', '焦虑安抚', '关系沟通', '情绪记录', '自我接纳'],
  },
  [AssistantCategory.Entertainment]: {
    author: 'Playground',
    avatars: ['🎭', '🎬', '🎵', '✨', '🕹️'],
    titles: ['故事接龙', '段子手', '影评助手', '角色扮演', '灵感玩具'],
    topics: ['短故事', '喜剧段子', '观影推荐', '人设对话', '脑洞挑战'],
  },
  [AssistantCategory.Games]: {
    author: 'GameForge',
    avatars: ['🎮', '🗡️', '🐉', '🏆', '🗺️'],
    titles: ['攻略助手', '副本指挥', '角色构建', '世界观编辑', '开黑队友'],
    topics: ['通关路线', 'Build 推荐', '剧情向导', '装备搭配', 'BOSS 机制'],
  },
  [AssistantCategory.General]: {
    author: 'PureChat',
    avatars: ['🤖', '💡', '🧠', '⚡', '🛠️'],
    titles: ['万能助手', '问题拆解', '日常参谋', '效率伙伴', '头脑风暴'],
    topics: ['任务规划', '信息整理', '决策辅助', '总结提炼', '创意发散'],
  },
  [AssistantCategory.Life]: {
    author: 'DailyLife',
    avatars: ['🏠', '🍳', '🧳', '🪴', '☕'],
    titles: ['生活管家', '食谱顾问', '旅行规划', '收纳教练', '健康节律'],
    topics: ['一日三餐', '周末出行', '家居整理', '作息建议', '节日安排'],
  },
  [AssistantCategory.Marketing]: {
    author: 'StartupHQ',
    avatars: ['🚀', '📊', '💸', '📢', '🧱'],
    titles: ['创业顾问', '增长黑客', '融资路演', '定位策略', 'GTM 策划'],
    topics: ['商业模式', '用户增长', '市场验证', '定价策略', '渠道获客'],
  },
  [AssistantCategory.Office]: {
    author: 'OfficeKit',
    avatars: ['📑', '📅', '🖨️', '🧾', '🗂️'],
    titles: ['会议纪要', '邮件润色', '周报助手', '流程梳理', '办公速记'],
    topics: ['会议摘要', '商务邮件', '项目进度', 'SOP 文档', '表格整理'],
  },
  [AssistantCategory.Programming]: {
    author: 'DevCoach',
    avatars: ['💻', '🐛', '⚙️', '🧩', '🖥️'],
    titles: ['代码评审', '调试搭档', '架构顾问', 'API 设计', '测试顾问'],
    topics: ['代码重构', '缺陷定位', '系统设计', '接口约定', '单测用例'],
  },
  [AssistantCategory.Translation]: {
    author: 'LangBridge',
    avatars: ['🌐', '🔤', '🇯🇵', '🇬🇧', '🗣️'],
    titles: ['双语翻译', '润色译员', '术语顾问', '本地化专家', '口译演练'],
    topics: ['中英互译', '术语统一', '语境润色', '文档本地化', '口语转写'],
  },
}

const AGENTS_PER_CATEGORY = 20

const pad = (n: number) => String(n).padStart(2, '0')

const createAgent = (
  category: AssistantBusinessCategory,
  index: number,
): DiscoverAgentItem => {
  const meta = CATEGORY_META[category]
  const slot = index % meta.titles.length
  const topic = meta.topics[index % meta.topics.length]
  const label = ASSISTANT_CATEGORY_LABELS[category]
  const title = `${meta.titles[slot]} ${pad(index + 1)}`
  const day = ((index * 3) % 28) + 1
  const month = ((index + slot) % 12) + 1

  return {
    author: meta.author,
    avatar: meta.avatars[index % meta.avatars.length],
    backgroundColor: 'transparent',
    category,
    createdAt: `2024-${pad(month)}-${pad(day)}`,
    description: `专注${label}场景下的「${topic}」，提供清晰步骤、可执行建议与示例输出。`,
    forkCount: (index * 7) % 40,
    identifier: `${category}-agent-${pad(index + 1)}`,
    knowledgeCount: index % 3,
    pluginCount: index % 4,
    systemRole: [
      `你是「${title}」，一名专业的${label}助理。`,
      `核心能力围绕「${topic}」。`,
      '回答要简洁、可执行，必要时给出分步清单与示例。',
      '若信息不足，先提出最多 2 个澄清问题。',
    ].join('\n'),
    title,
    tokenUsage: 800 + index * 137 + slot * 41,
  }
}

export const COMMUNITY_AGENTS: DiscoverAgentItem[] = ASSISTANT_BUSINESS_CATEGORIES.flatMap(
  (category) =>
    Array.from({ length: AGENTS_PER_CATEGORY }, (_, index) => createAgent(category, index)),
)

export const getAssistantCategoryCounts = (
  agents: DiscoverAgentItem[] = COMMUNITY_AGENTS,
): Record<AssistantCategory, number> => {
  const counts = Object.fromEntries(
    Object.values(AssistantCategory).map((key) => [key, 0]),
  ) as Record<AssistantCategory, number>

  for (const agent of agents) {
    counts[agent.category] += 1
  }

  counts[AssistantCategory.All] = agents.length
  return counts
}

export const filterCommunityAgents = (
  agents: DiscoverAgentItem[],
  options: { category?: string | null; q?: string | null },
): DiscoverAgentItem[] => {
  const category = options.category ?? AssistantCategory.All
  const query = options.q?.trim().toLowerCase() ?? ''

  return agents.filter((agent) => {
    const matchCategory =
      category === AssistantCategory.All || agent.category === category
    if (!matchCategory) return false

    if (!query) return true

    const haystack = [agent.title, agent.description, agent.author, agent.identifier]
      .join(' ')
      .toLowerCase()
    return haystack.includes(query)
  })
}
