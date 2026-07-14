import type { LucideIcon } from 'lucide-react'
import {
  BabyIcon,
  CameraIcon,
  ChartNetworkIcon,
  CodeXmlIcon,
  CompassIcon,
  GraduationCapIcon,
  HandCoinsIcon,
  HeartIcon,
  HomeIcon,
  LineChartIcon,
  PaintBucketIcon,
  PenIcon,
  PercentIcon,
  ScaleIcon,
  SettingsIcon,
  TargetIcon,
  UsersIcon,
} from 'lucide-react'

export const INTEREST_AREA_KEYS = [
  'writing',
  'coding',
  'design',
  'education',
  'business',
  'marketing',
  'product',
  'sales',
  'operations',
  'hr',
  'finance-legal',
  'creator',
  'investing',
  'parenting',
  'health',
  'hobbies',
  'personal',
] as const

export type InterestAreaKey = (typeof INTEREST_AREA_KEYS)[number]

const interestAreaKeySet = new Set<string>(INTEREST_AREA_KEYS)

export const isInterestAreaKey = (value: string): value is InterestAreaKey =>
  interestAreaKeySet.has(value)

export const resolveInterestAreaKey = (value: string): InterestAreaKey | undefined => {
  const normalized = value.trim()
  return isInterestAreaKey(normalized) ? normalized : undefined
}

export const normalizeInterestsForStorage = (interests: readonly string[]): string[] => {
  const result: string[] = []
  const seen = new Set<string>()

  for (const interest of interests) {
    const trimmed = interest.trim()
    if (!trimmed) continue

    const areaKey = resolveInterestAreaKey(trimmed)
    const normalized = areaKey ?? trimmed
    const dedupeKey = areaKey ? `area:${areaKey}` : `raw:${trimmed}`

    if (seen.has(dedupeKey)) continue

    seen.add(dedupeKey)
    result.push(normalized)
  }

  return result
}

const INTEREST_AREA_ICONS: Record<InterestAreaKey, LucideIcon> = {
  'business': ChartNetworkIcon,
  'coding': CodeXmlIcon,
  'creator': CameraIcon,
  'design': PaintBucketIcon,
  'education': GraduationCapIcon,
  'finance-legal': ScaleIcon,
  'health': HeartIcon,
  'hobbies': CompassIcon,
  'hr': UsersIcon,
  'investing': LineChartIcon,
  'marketing': PercentIcon,
  'operations': SettingsIcon,
  'parenting': BabyIcon,
  'personal': HomeIcon,
  'product': TargetIcon,
  'sales': HandCoinsIcon,
  'writing': PenIcon,
}

export const INTEREST_AREA_LABELS: Record<InterestAreaKey, string> = {
  'business': '商业与战略',
  'coding': '编程与开发',
  'creator': '创作者经济',
  'design': '设计与创意',
  'education': '学习与研究',
  'finance-legal': '金融与法律',
  'health': '健康与习惯',
  'hobbies': '爱好与文化',
  'hr': '人事与人力资源',
  'investing': '投资与财经',
  'marketing': '市场与推广',
  'operations': '运营与行政',
  'parenting': '家庭与育儿',
  'personal': '个人生活',
  'product': '产品与管理',
  'sales': '销售与客户',
  'writing': '内容创作',
}

export const INTEREST_AREAS = INTEREST_AREA_KEYS.map((key) => ({
  icon: INTEREST_AREA_ICONS[key],
  key,
  label: INTEREST_AREA_LABELS[key],
}))
