'use client'

import type { MenuProps } from '@lobehub/ui'
import { ActionIcon, DropdownMenu, Flexbox } from '@lobehub/ui'
import { MoreHorizontalIcon, PlusIcon } from 'lucide-react'
import { memo } from 'react'

interface SectionActionsProps {
  addMenuItems?: MenuProps['items']
  menuItems: MenuProps['items']
}

const SectionActions = memo<SectionActionsProps>(({ addMenuItems, menuItems }) => {
  return (
    <Flexbox
      horizontal
      gap={2}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <DropdownMenu items={menuItems} nativeButton={false}>
        <ActionIcon icon={MoreHorizontalIcon} size='small' style={{ flex: 'none' }} title='更多' />
      </DropdownMenu>
      {addMenuItems ? (
        <DropdownMenu items={addMenuItems} nativeButton={false}>
          <ActionIcon icon={PlusIcon} size='small' style={{ flex: 'none' }} title='添加' />
        </DropdownMenu>
      ) : null}
    </Flexbox>
  )
})

SectionActions.displayName = 'SectionActions'

export default SectionActions
