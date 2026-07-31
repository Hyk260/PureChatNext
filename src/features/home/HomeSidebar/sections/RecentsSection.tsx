'use client'

import { AccordionItem, Text, Flexbox } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo } from 'react'

import SectionActions from '@/features/home/HomeSidebar/components/SectionActions'
import { useAgentSectionDropdownMenu } from '@/features/home/HomeSidebar/hooks/useAgentSectionDropdownMenu'

const styles = createStaticStyles(({ css }) => ({
  empty: css`
    color: ${cssVar.colorTextQuaternary};
  `,
}))

interface RecentsSectionProps {
  itemKey: string
}

const RecentsSection = memo<RecentsSectionProps>(({ itemKey }) => {
  const dropdownMenu = useAgentSectionDropdownMenu()

  return (
    <AccordionItem
      action={<SectionActions menuItems={dropdownMenu} />}
      itemKey={itemKey}
      paddingBlock={4}
      paddingInline='8px 4px'
      title={
        <Text ellipsis type='secondary' style={{ fontSize: 12, fontWeight: 500 }}>
          最近
        </Text>
      }
    >
      <Flexbox style={{ paddingBlock: 4, paddingInline: 12 }}>
        <Text className={styles.empty} style={{ fontSize: 12 }}>
          暂无内容
        </Text>
      </Flexbox>
    </AccordionItem>
  )
})

RecentsSection.displayName = 'RecentsSection'

export default RecentsSection
