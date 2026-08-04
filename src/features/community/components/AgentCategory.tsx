'use client'

import { Icon, Tag, Text, Flexbox } from '@pure/ui'
import { createStaticStyles, cssVar, cx } from 'antd-style'
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

const styles = createStaticStyles(({ css }) => ({
  count: css`
    margin-inline-start: auto;
  `,
  item: css`
    cursor: pointer;
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: ${cssVar.colorTextSecondary};
    font-size: 14px;
    text-align: left;
    transition:
      background 0.15s ease,
      color 0.15s ease;

    &:hover {
      background: ${cssVar.colorFillSecondary};
      color: ${cssVar.colorText};
    }

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: -2px;
    }
  `,
  active: css`
    && {
      background: ${cssVar.colorPrimaryBg};
      color: ${cssVar.colorPrimaryText};
    }

    &&:hover {
      background: ${cssVar.colorPrimaryBgHover};
    }
  `,
  root: css`
    flex: none;
    width: 220px;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  `,
}))

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
    <Flexbox className={styles.root}>
      <Scrollbar style={{ height: '100%', width: '100%' }}>
        <Flexbox gap={4}>
          {CATEGORY_KEYS.map((key) => {
            const isActive = selected === key
            return (
              <button
                className={cx(styles.item, isActive && styles.active)}
                key={key}
                type='button'
                onClick={() => handleSelect(key)}
              >
                <Icon icon={CATEGORY_ICONS[key]} size={18} />
                <Text ellipsis>{ASSISTANT_CATEGORY_LABELS[key]}</Text>
                {counts[key] > 0 ? (
                  <Tag
                    className={styles.count}
                    size='small'
                    style={{ borderRadius: 12, paddingInline: 6, fontSize: 12, lineHeight: '20px' }}
                  >
                    {counts[key]}
                  </Tag>
                ) : null}
              </button>
            )
          })}
        </Flexbox>
      </Scrollbar>
    </Flexbox>
  )
})

AgentCategory.displayName = 'AgentCategory'

export default AgentCategory
