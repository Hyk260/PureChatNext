'use client'

import { AccordionHeader, AccordionItem, AccordionPanel, AccordionTrigger, Text, Flex } from '@pure/ui'
import { createStaticStyles, cssVar } from '@lobehub/ui'
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
    <AccordionItem value={itemKey}>
      <AccordionHeader style={{ paddingBlock: 4, paddingInline: '8px 4px' }}>
        <AccordionTrigger>
          <Text className='text-[12px] font-medium' ellipsis type='secondary'>
            最近
          </Text>
        </AccordionTrigger>
        {<SectionActions menuItems={dropdownMenu} />}
      </AccordionHeader>
      <AccordionPanel>
        <Flex className='flex-col py-1 px-3'>
          <Text className={`${styles.empty} text-[12px]`}>暂无内容</Text>
        </Flex>
      </AccordionPanel>
    </AccordionItem>
  )
})

RecentsSection.displayName = 'RecentsSection'

export default RecentsSection
