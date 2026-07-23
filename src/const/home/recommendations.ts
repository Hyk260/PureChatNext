export interface HomeRecommendationItem {
  description: string
  id: string
  tag: string
  title: string
}

export const HOME_RECOMMENDATIONS: HomeRecommendationItem[] = [
  {
    description: '每周自动扫描项目依赖漏洞，生成修复建议报告，帮助团队保持供应链安全。',
    id: 'dependency-security',
    tag: '模板',
    title: '依赖安全周检',
  },
  {
    description: '根据代码变更自动生成 PR 摘要与测试清单，减少 review 前的沟通成本。',
    id: 'pr-summary',
    tag: '模板',
    title: 'PR 摘要助手',
  },
  {
    description: '整理会议纪要、提取待办事项并同步到任务列表，让协作更高效。',
    id: 'meeting-notes',
    tag: '模板',
    title: '会议纪要整理',
  },
]
