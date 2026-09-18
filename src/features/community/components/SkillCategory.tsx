'use client'

import { Icon, Tag, Text, Flex } from '@pure/ui'
import { cx } from 'antd-style'
import {
  Apple,
  BarChart2,
  Book,
  BookOpen,
  Bot,
  Brain,
  Calendar,
  CheckSquare,
  Cloud,
  DollarSign,
  FileText,
  GamepadIcon,
  GitBranch,
  Globe,
  Heart,
  Home,
  Image,
  LayoutPanelTop,
  Megaphone,
  MessageCircle,
  Mic,
  Monitor,
  Network,
  Play,
  Search,
  Server,
  Shield,
  ShoppingCart,
  Smartphone,
  Terminal,
  Truck,
  User,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { memo, useCallback, useMemo } from 'react'

import Scrollbar from '@/components/Scrollbar'
import {
  getSkillCategoryCounts,
  SKILL_BUSINESS_CATEGORIES,
  SKILL_CATEGORY_LABELS,
} from '@/const/community/skills'
import { SkillCategory } from '@/features/community/types'

import { communityCategoryStyles } from './communityCategoryStyles'

const CATEGORY_ICONS: Record<SkillCategory, LucideIcon> = {
  [SkillCategory.All]: LayoutPanelTop,
  [SkillCategory.AgentToAgentProtocols]: Network,
  [SkillCategory.AILLMs]: Brain,
  [SkillCategory.AppleAppsServices]: Apple,
  [SkillCategory.BrowserAutomation]: Globe,
  [SkillCategory.CalendarScheduling]: Calendar,
  [SkillCategory.ClawdbotTools]: Wrench,
  [SkillCategory.CLIUtilities]: Terminal,
  [SkillCategory.CodingAgentsIDEs]: Bot,
  [SkillCategory.Communication]: MessageCircle,
  [SkillCategory.DataAnalytics]: BarChart2,
  [SkillCategory.DevOpsCloud]: Cloud,
  [SkillCategory.Finance]: DollarSign,
  [SkillCategory.Gaming]: GamepadIcon,
  [SkillCategory.GitGitHub]: GitBranch,
  [SkillCategory.HealthFitness]: Heart,
  [SkillCategory.ImageVideoGeneration]: Image,
  [SkillCategory.IOSMacOSDevelopment]: Smartphone,
  [SkillCategory.MarketingSales]: Megaphone,
  [SkillCategory.MediaStreaming]: Play,
  [SkillCategory.Moltbook]: Book,
  [SkillCategory.NotesPKM]: BookOpen,
  [SkillCategory.PDFDocuments]: FileText,
  [SkillCategory.PersonalDevelopment]: User,
  [SkillCategory.ProductivityTasks]: CheckSquare,
  [SkillCategory.SearchResearch]: Search,
  [SkillCategory.SecurityPasswords]: Shield,
  [SkillCategory.SelfHostedAutomation]: Server,
  [SkillCategory.ShoppingEcommerce]: ShoppingCart,
  [SkillCategory.SmartHomeIoT]: Home,
  [SkillCategory.SpeechTranscription]: Mic,
  [SkillCategory.Transportation]: Truck,
  [SkillCategory.WebFrontendDevelopment]: Monitor,
}

const CATEGORY_KEYS: SkillCategory[] = [SkillCategory.All, ...SKILL_BUSINESS_CATEGORIES]

const SkillCategoryNav = memo(() => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selected = (searchParams.get('category') as SkillCategory | null) ?? SkillCategory.All
  const counts = useMemo(() => getSkillCategoryCounts(), [])

  const handleSelect = useCallback(
    (key: SkillCategory) => {
      const next = new URLSearchParams(searchParams.toString())
      if (key === SkillCategory.All) {
        next.delete('category')
      } else {
        next.set('category', key)
      }
      next.delete('page')
      const query = next.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  return (
    <Flex className={[communityCategoryStyles.root, 'flex-col']}>
      <Scrollbar className='size-full'>
        <Flex className='flex-col gap-1'>
          {CATEGORY_KEYS.map((key) => {
            const isActive = selected === key
            return (
              <button
                className={cx(communityCategoryStyles.item, isActive && communityCategoryStyles.active)}
                key={key}
                type='button'
                onClick={() => handleSelect(key)}
              >
                <Icon icon={CATEGORY_ICONS[key]} size={18} />
                <Text ellipsis>{SKILL_CATEGORY_LABELS[key]}</Text>
                {counts[key] > 0 ? (
                  <Tag
                    className={communityCategoryStyles.count}
                    size='small'
                    style={{ borderRadius: 12, paddingInline: 6, fontSize: 12, lineHeight: '20px' }}
                  >
                    {counts[key]}
                  </Tag>
                ) : null}
              </button>
            )
          })}
        </Flex>
      </Scrollbar>
    </Flex>
  )
})

SkillCategoryNav.displayName = 'SkillCategoryNav'

export default SkillCategoryNav
