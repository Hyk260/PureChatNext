'use client'

import type { MenuProps } from '@lobehub/ui'
import { ActionIcon, DropdownMenu, Flexbox } from '@lobehub/ui'
import { MoreHorizontalIcon } from 'lucide-react'
import { memo, type ReactNode } from 'react'

interface SectionActionsProps {
  menuItems: MenuProps['items']
  trailing?: ReactNode
}

const SectionActions = memo<SectionActionsProps>(({ menuItems, trailing }) => {
  return (
    <Flexbox horizontal gap={2}>
      <DropdownMenu items={menuItems} nativeButton={false}>
        <ActionIcon icon={MoreHorizontalIcon} size='small' style={{ flex: 'none' }} />
      </DropdownMenu>
      {trailing}
    </Flexbox>
  )
})

SectionActions.displayName = 'SectionActions'

export default SectionActions
