'use client'

import { Icon, Tag, Text, Flex } from '@pure/ui'
import { cx } from 'antd-style'
import {
  BadgeDollarSignIcon,
  BriefcaseIcon,
  Coffee,
  DramaIcon,
  GamepadIcon,
  GraduationCapIcon,
  ImageIcon,
  LanguagesIcon,
  LaughIcon,
  Layers,
  LayoutPanelTop,
  MicroscopeIcon,
  PencilIcon,
  PrinterIcon,
  TerminalSquareIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from '@/utils/navigation'
import { memo, useCallback, useMemo } from 'react'

import Scrollbar from '@/components/Scrollbar'
import {
  ASSISTANT_BUSINESS_CATEGORIES,
  ASSISTANT_CATEGORY_LABELS,
  getAssistantCategoryCounts,
} from '@/const/community/agents'
import { AssistantCategory } from '@/features/community/types'

import { communityCategoryStyles } from './communityCategoryStyles'

const CATEGORY_ICONS: Record<AssistantCategory, LucideIcon> = {
  [AssistantCategory.All]: LayoutPanelTop,
  [AssistantCategory.Academic]: MicroscopeIcon,
  [AssistantCategory.Career]: BriefcaseIcon,
  [AssistantCategory.CopyWriting]: PencilIcon,
  [AssistantCategory.Design]: ImageIcon,
  [AssistantCategory.Education]: GraduationCapIcon,
  [AssistantCategory.Emotions]: LaughIcon,
  [AssistantCategory.Entertainment]: DramaIcon,
  [AssistantCategory.Games]: GamepadIcon,
  [AssistantCategory.General]: Layers,
  [AssistantCategory.Life]: Coffee,
  [AssistantCategory.Marketing]: BadgeDollarSignIcon,
  [AssistantCategory.Office]: PrinterIcon,
  [AssistantCategory.Programming]: TerminalSquareIcon,
  [AssistantCategory.Translation]: LanguagesIcon,
}

const CATEGORY_KEYS: AssistantCategory[] = [AssistantCategory.All, ...ASSISTANT_BUSINESS_CATEGORIES]

const AgentCategory = memo(() => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selected = (searchParams.get('category') as AssistantCategory | null) ?? AssistantCategory.All
  const counts = useMemo(() => getAssistantCategoryCounts(), [])

  const handleSelect = useCallback(
    (key: AssistantCategory) => {
      const next = new URLSearchParams(searchParams.toString())
      if (key === AssistantCategory.All) {
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
                <Text ellipsis>{ASSISTANT_CATEGORY_LABELS[key]}</Text>
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

AgentCategory.displayName = 'AgentCategory'

export default AgentCategory
